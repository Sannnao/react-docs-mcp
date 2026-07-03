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
import CONFIG from './config.js';
import type { ParsedDoc } from './types.js';

function titleCase(section: string): string {
  return section
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Build the public doc URL for a parsed document. When the active preset's
 * docUrl.useFrontmatterId is true, a frontmatter `id` field takes priority
 * over the file-path-derived slug (needed for docs sites like Docusaurus
 * where `id` can diverge from the file path).
 */
function buildDocUrl(doc: ParsedDoc): string {
  let slug = doc.path;
  const id = doc.metadata.id as string | undefined;

  if (CONFIG.docUrl.useFrontmatterId && id) {
    if (id.includes('/')) {
      slug = id;
    } else {
      const parts = doc.path.split('/');
      parts[parts.length - 1] = id;
      slug = parts.join('/');
    }
  }

  return `${CONFIG.docUrl.base}/${slug}`;
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
    section: z.string().optional().describe(`Filter by section (${CONFIG.sections.join(', ')})`),
    limit: z.number().min(1).max(CONFIG.search.maxLimit).optional().describe('Maximum number of results'),
  });

  const getDocSchema = z.object({
    path: z.string().describe('Document path (e.g., "learn/hooks/useState")'),
  });

  const resourceUriRegex = new RegExp(`^${CONFIG.resourceUriScheme}:\\/\\/(.+)$`);

  // Register list resources handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: CONFIG.sections.map(section => {
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
          description: `Get a concise summary of a documentation page (~1500 chars). Use ${CONFIG.searchToolName} first - only call this if you need more detail than the search snippet provides.`,
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Document path (e.g., "learn/hooks/useState")',
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
          const sections = searchEngine.getSections();

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
          const { path } = getDocSchema.parse(args);
          const doc = await searchEngine.getDocByPath(path);

          if (!doc) {
            throw new Error(`Document not found: ${path}`);
          }

          // Return concise summary instead of full content
          const summary = summarizeContent(doc.content, 1500);
          const structure = extractStructure(doc.content);

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
                    summary,
                    structure,
                    url: buildDocUrl(doc),
                    note: 'This is a summary. Visit the URL for full documentation.',
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
