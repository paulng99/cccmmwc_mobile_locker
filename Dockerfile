FROM node:22-alpine
WORKDIR /app
ENV TZ=Asia/Hong_Kong
ENV NEXT_TELEMETRY_DISABLED=1
ENV CABINET_PROXY_PORT=3001
ENV NEXT_PUBLIC_CABINET_PROXY_PORT=3001
ENV LOCKER_APP_PORT=3000
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.cjs && (node --experimental-strip-types src/cabinet-proxy-server.ts &) && exec npm start"]
