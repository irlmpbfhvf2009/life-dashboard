# 菜菜勇者團 game server — Cloud Run 部署（build context = game/ 整個目錄，
# 因為 server 依賴 ../shared 的內容表；用 gcloud run deploy --source game 部署）。
FROM node:22-slim

WORKDIR /app
COPY shared ./shared
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/src ./server/src
COPY server/tsconfig.json ./server/

WORKDIR /app/server
ENV NODE_ENV=production
# PORT 由 Cloud Run 注入（index.ts 讀 process.env.PORT）
CMD ["npm", "start"]
