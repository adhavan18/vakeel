variable "aws_region" { type = string; default = "ap-south-1" }
variable "project_name" { type = string; default = "platform-lab" }
variable "environment" { type = string; default = "dev" }
variable "vpc_cidr" { type = string; default = "10.42.0.0/16" }
variable "container_image" { type = string; default = "public.ecr.aws/docker/library/node:22-alpine" }
