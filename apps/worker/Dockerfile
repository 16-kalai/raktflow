# Built from a `pnpm deploy` bundle (see deploy/build-worker.sh), so the image
# build needs no registry access beyond the base image.
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY out/worker/ ./
USER 1000
EXPOSE 8080
CMD ["node", "--import", "tsx", "src/main.ts"]
