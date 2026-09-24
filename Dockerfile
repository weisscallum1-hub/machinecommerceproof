FROM node:22-alpine
WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=4020
ENV DATA_DIR=/app/data
COPY server/package.json ./package.json
COPY server/src ./src
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 4020
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:4020/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
