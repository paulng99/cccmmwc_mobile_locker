FROM node:22-alpine
WORKDIR /app
ENV TZ=Asia/Hong_Kong
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.cjs && npm start"]
