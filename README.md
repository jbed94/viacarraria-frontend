# Via Carraria Frontend

React and React Flow client for the Via Carraria interactive knowledge canvas.

## Development

```bash
mamba run -n viacarraria-frontend pnpm install
mamba run -n viacarraria-frontend pnpm dev
```

The application provides a React Flow canvas, Dagre layout, contextual topic
selection, spatial result highlighting, document viewer, query history, graph
builder with debounced autosave, immediate source uploads, authentication,
profile controls, and local-first subscription controls. Copy `.env.example` to
`.env` for local endpoint configuration.
