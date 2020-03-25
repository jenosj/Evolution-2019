#!/usr/bin/env sh
pid='ps -eaf | grep node | grep -v grep | wc -l'
if [ "$pid"="0" ]
then
cd /home/ec2-user/node/Evolution-2018/
rm -rf nohup.out
nohup /home/ec2-user/node/node-v8.11.1-linux-x64/bin/node /home/ec2-user/node/Evolution-2018/index.js &
else
echo service is ok >> /tmp/node_JS_status_$(date +%Y-%m-%d).log
fi
