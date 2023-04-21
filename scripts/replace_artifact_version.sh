#!/bin/bash

cd $1

for i in $(find $1 -name pom.xml)
do
  if $(grep --quiet -i -r $2 $i); then
    sed -i -r "/$2/{n;s/<version>(.+)<\/version>/<version>$3<\/version>/}" $i
  fi
done
