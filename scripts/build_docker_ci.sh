#!/usr/bin/env bash
set -e

imageName='openai-proxy'
ECR_URL=juzibot
PACKAGE_VERSION=$IMAGE_TAG

echo current package version: "$PACKAGE_VERSION"

echo docker build -t "$imageName":"$PACKAGE_VERSION" .
docker build -t "$imageName":"$PACKAGE_VERSION" .

echo docker tag "$imageName":"$PACKAGE_VERSION" $ECR_URL/"$imageName":"$PACKAGE_VERSION"
docker tag "$imageName":"$PACKAGE_VERSION" $ECR_URL/"$imageName":"$PACKAGE_VERSION"

echo docker push $ECR_URL/"$imageName":"$PACKAGE_VERSION"
docker push $ECR_URL/"$imageName":"$PACKAGE_VERSION"
