FROM python:3.8-slim-bookworm AS app

# set environment variables
ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=TRUE
ENV PYTHONUNBUFFERED=TRUE

# install system dependencies
RUN apt-get update -y --fix-missing \
    && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    libgmp3-dev \
    libz-dev \
    libreadline-dev \
    libncurses5-dev \
    gettext \
    postgresql-client \
    gfortran \
    libblas-dev \
    liblapack-dev \
    libmetis-dev \
    coinor-cbc \
    git \
    && rm -rf /var/lib/apt/lists/*

# install python packages
WORKDIR /www
COPY requirements.txt requirements-dev.txt /www/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt && pip install -r requirements-dev.txt
# Install calliope without dependencies, as already installed in requirements
RUN pip install calliope==0.6.8 --no-deps

# Uninstall git
RUN apt remove git -y && apt autoremove -y


COPY . .

# For calliope==0.6.8 works with HiGHS solver in pyomo==6.7.0
COPY ./calliope-files/backend/pyomo/model.py /usr/local/lib/python3.8/site-packages/calliope/backend/pyomo/model.py
COPY ./calliope-files/backend/run.py /usr/local/lib/python3.8/site-packages/calliope/backend/run.py

RUN pip install -e .
