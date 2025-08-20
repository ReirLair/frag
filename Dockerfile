FROM node:20-alpine
WORKDIR /app
COPY . .
RUN chmod 777 /app
RUN npm install express body-parser axios
EXPOSE 7860
CMD ["node", "server.js"]