FROM node:8.9.1-stretch

RUN npm install -g typescript

WORKDIR /root/work
COPY package.json package-lock.json /root/work/
RUN npm install --no-bin-links

VOLUME /root/work/data/
COPY tsconfig.json /root/work/
COPY src/ /root/work/src/
RUN tsc

ENTRYPOINT ["/bin/bash"]
