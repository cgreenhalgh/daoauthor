FROM node:8.9.1-stretch

RUN npm install -g typescript

COPY . /root/work/
VOLUME /root/work

ENTRYPOINT ["/bin/bash"]
