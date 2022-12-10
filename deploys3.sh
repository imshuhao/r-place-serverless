#!/bin/bash

aws cloudformation deploy \
--template-file static.yaml \
--stack-name r-place-cloudfront-distribution

aws cloudformation describe-stacks \
--stack-name r-place-cloudfront-distribution
