# Container for registry checks (Glama, and anything else that boots an MCP server
# in a sandbox). Runs the stdio server from the published sources in this repo.
#
# Build from the repository root:
#   docker build -f luminote-mcp-server/Dockerfile -t luminote-mcp .
#   docker run --rm -i luminote-mcp
#
# The server needs no credentials to start: it exposes its WebSocket bridge on
# 127.0.0.1:19960 and waits for the browser extension. Tool calls fail until an
# extension connects, but initialize / tools/list / resources/list all respond,
# which is what registries introspect.
FROM node:22-alpine

WORKDIR /app

COPY luminote-mcp-server/package.json luminote-mcp-server/package-lock.json ./
RUN npm ci --omit=dev

COPY luminote-mcp-server/index.js ./

ENV NODE_ENV=production

ENTRYPOINT ["node", "index.js"]
