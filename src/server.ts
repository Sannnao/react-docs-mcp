/**
 * server.ts
 * Builds and runs the MCP server against the currently active CONFIG.
 * Call configure() with the desired preset before createServer().
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DocsManager } from './docsManager.js';
import { SearchEngine } from './searchEngine.js';
import { summarizeContent, extractStructure } from './summarizer.js';
import { titleCase } from './markdownParser.js';
import CONFIG from './config.js';
import type { ParsedDoc } from './types.js';

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the public doc URL for a parsed document. doc.path is already the
 * canonical slug: for useFrontmatterId presets, SearchEngine resolves the
 * frontmatter id into the path at index time, so URLs, paths, and get_doc
 * lookups all agree.
 */
function buildDocUrl(doc: ParsedDoc): string {
  return `${CONFIG.docUrl.base}/${doc.path}`;
}

export async function createServer(): Promise<void> {
  // Initialize components
  const docsManager = new DocsManager();
  const searchEngine = new SearchEngine(docsManager);

  // Create MCP server
  const server = new Server(
    {
      name: CONFIG.server.name,
      version: CONFIG.server.version,
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  // Tool input schemas
  const searchDocsSchema = z.object({
    query: z.string().describe('Search query string'),
    section: z
      .string()
      .optional()
      .refine(section => section === undefined || CONFIG.sections.includes(section), {
        message: `Unknown section. Valid sections: ${CONFIG.sections.join(', ')}`,
      })
      .describe(`Filter by section (${CONFIG.sections.join(', ')})`),
    limit: z.number().min(1).max(CONFIG.search.maxLimit).optional().describe('Maximum number of results'),
  });

  const getDocSchema = z.object({
    path: z.string().describe(`Document path (e.g., "${CONFIG.pathExample}")`),
    full: z.boolean().optional().describe('Return the full raw page content instead of a ~1500 char summary'),
  });

  const resourceUriRegex = new RegExp(`^${escapeRegExp(CONFIG.resourceUriScheme)}:\\/\\/(.+)$`);

  // Register list resources handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    // Only advertise sections that exist in the checked-out docs — e.g. older
    // versioned snapshots may predate a section like releases/
    const existingSections = await docsManager.getExistingSections(CONFIG.sections);

    return {
      resources: existingSections.map(section => {
        const override = CONFIG.sectionResourceOverrides?.[section];

        return {
          uri: `${CONFIG.resourceUriScheme}://${section}`,
          name: override?.name ?? `${CONFIG.docsLabel} ${titleCase(section)} Documentation`,
          description: override?.description ?? `${CONFIG.docsLabel} documentation for the ${section} section`,
          mimeType: 'text/plain',
        };
      }),
    };
  });

  // Register read resource handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri.toString();

    // Parse URI: {resourceUriScheme}://{section}/{path}
    const match = uri.match(resourceUriRegex);
    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }

    const resourcePath = match[1];

    // If requesting just a section, list docs in that section
    if (CONFIG.sections.includes(resourcePath)) {
      const docs = await searchEngine.getDocsBySection(resourcePath);
      const docList = docs
        .map(doc => `- ${doc.metadata.title} (${doc.path})`)
        .join('\n');

      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: `# ${resourcePath} Documentation\n\nAvailable documents:\n\n${docList}`,
          },
        ],
      };
    }

    // Otherwise, fetch specific document
    const doc = await searchEngine.getDocByPath(resourcePath);

    if (!doc) {
      throw new Error(`Document not found: ${resourcePath}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: `# ${doc.metadata.title}\n\n${doc.content}`,
        },
      ],
    };
  });

  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: CONFIG.searchToolName,
          description: CONFIG.searchToolDescription,
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query string',
              },
              section: {
                type: 'string',
                description: `Filter by section (${CONFIG.sections.join(', ')})`,
                enum: [...CONFIG.sections],
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results',
                minimum: 1,
                maximum: CONFIG.search.maxLimit,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'list_sections',
          description: 'List all available documentation sections',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_doc',
          description: `Get a concise summary of a documentation page (~1500 chars), or the full raw page with full:true. Use ${CONFIG.searchToolName} first - only call this if you need more detail than the search snippet provides.`,
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: `Document path (e.g., "${CONFIG.pathExample}")`,
              },
              full: {
                type: 'boolean',
                description: 'Return the full raw page content instead of a ~1500 char summary',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'update_docs',
          description: 'Pull latest documentation from Git repository',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  });

  // Register call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case CONFIG.searchToolName: {
          const { query, section, limit } = searchDocsSchema.parse(args);
          const results = await searchEngine.search(query, { section, limit });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  results.map(r => ({
                    path: r.doc.path,
                    title: r.doc.metadata.title,
                    snippet: r.snippet,
                    score: r.score,
                    url: buildDocUrl(r.doc),
                  })),
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'list_sections': {
          const sections = await docsManager.getExistingSections(CONFIG.sections);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(sections, null, 2),
              },
            ],
          };
        }

        case 'get_doc': {
          const { path, full } = getDocSchema.parse(args);
          const doc = await searchEngine.getDocByPath(path);

          if (!doc) {
            throw new Error(`Document not found: ${path}`);
          }

          const body = full
            ? { content: doc.content, note: 'Full page content.' }
            : {
                summary: summarizeContent(doc.content, 1500),
                structure: extractStructure(doc.content),
                note: 'This is a summary. Pass full:true for the complete page, or visit the URL.',
              };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    path: doc.path,
                    section: doc.section,
                    title: doc.metadata.title,
                    description: doc.metadata.description,
                    ...body,
                    url: buildDocUrl(doc),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'update_docs': {
          const updated = await docsManager.updateRepo();

          if (updated) {
            // Re-index documents after update
            await searchEngine.indexDocuments();
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    updated,
                    message: updated
                      ? 'Documentation updated successfully'
                      : 'Documentation already up to date',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid arguments: ${error.message}`);
      }
      throw error;
    }
  });

  console.error(`Initializing ${CONFIG.docsLabel} Docs MCP Server...`);

  // Initialize repository
  await docsManager.initialize();

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`${CONFIG.docsLabel} Docs MCP Server running`);
}
