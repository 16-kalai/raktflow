# The worker is bundled into one file on the build machine (deploy/build-worker.sh),
# so the image needs no compilers, package manager or registry access.
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY out/main.mjs ./main.mjs
USER 1000
EXPOSE 8080
CMD ["node", "main.mjs"]
