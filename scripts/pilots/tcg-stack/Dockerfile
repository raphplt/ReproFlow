FROM reproflow-runner:local AS engine
FROM mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27 AS dependencies
USER root
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-16 postgresql-16-pgvector && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/tcg
COPY source/package.json source/package-lock.json ./
COPY source/apps/api/package.json apps/api/package.json
COPY source/apps/web/package.json apps/web/package.json
COPY source/packages packages
RUN npm ci --workspace=api --workspace=web --include-workspace-root
COPY source/apps/api apps/api
COPY source/apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL=/api NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 NEXT_PUBLIC_SEALED_CDN_URL=/disabled
RUN ./node_modules/.bin/tsc -p packages/pokemon-dataset/tsconfig.build.json && npm run build --workspace=api

FROM dependencies AS fixed
RUN npm run build --workspace=web

FROM dependencies AS buggy
COPY adapter/MarketplaceSearch.buggy.tsx apps/web/app/[locale]/(main)/marketplace/_components/MarketplaceSearch.tsx
RUN npm run build --workspace=web

FROM dependencies AS runtime
COPY --from=engine /opt/reproflow /opt/reproflow
COPY --from=fixed /opt/tcg/apps/web/.next/standalone /opt/tcg-fixed
COPY --from=fixed /opt/tcg/apps/web/.next/static /opt/tcg-fixed/apps/web/.next/static
COPY --from=fixed /opt/tcg/apps/web/public /opt/tcg-fixed/apps/web/public
COPY --from=buggy /opt/tcg/apps/web/.next/standalone /opt/tcg-buggy
COPY --from=buggy /opt/tcg/apps/web/.next/static /opt/tcg-buggy/apps/web/.next/static
COPY --from=buggy /opt/tcg/apps/web/public /opt/tcg-buggy/apps/web/public
COPY adapter/stack.cjs /opt/tcg/stack.cjs
COPY adapter/provenance.json /opt/tcg/provenance.json
ENV NODE_ENV=test DATABASE_HOST=127.0.0.1 DATABASE_PORT=5432 DATABASE_USER=reproflow DATABASE_NAME=reproflow DATABASE_SSL=false DATABASE_SYNCHRONIZE=true EXTERNAL_TOURNAMENT_API_URL= SEED_ENABLED=false NEXT_TELEMETRY_DISABLED=1
USER pwuser
WORKDIR /work
ENTRYPOINT ["node", "/opt/reproflow/workers/runner/dist/container.js"]
