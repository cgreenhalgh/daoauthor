FROM node:8.9.1-stretch

RUN npm install -g typescript

COPY . /root/work/
VOLUME /root/work/data/

WORKDIR /root/work
RUN npm install --no-bin-links
RUN tsc

ENTRYPOINT ["/bin/bash"]
