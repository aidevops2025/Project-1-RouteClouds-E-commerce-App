# RouteClouds E-Commerce Platform - Local Development Guide

This project demonstrates a modern cloud-native e-commerce application using React for the frontend, Node.js/Express for the backend, and PostgreSQL as the database.

## Project Overview

- **Frontend**: Built with [React](https://reactjs.org/) and Vite for a fast, modern UI.
- **Backend**: Powered by [Node.js/Express](https://expressjs.com/) with TypeScript for robust API development.
- **Database**: Uses [PostgreSQL](https://www.postgresql.org/) for reliable, scalable data storage.

## Prerequisites

Ensure the following tools are installed on your system before proceeding:

- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)
- Basic understanding of containerized applications

---

## Getting Started

### 1. Build and Start the Containers

Run the following command to build and start the application containers:

```bash
docker-compose up --build
```

This will build the Docker images and start the containers for the frontend, backend, and database.

---

### 2. Stop the Application

To stop the application and remove the containers, run:

```bash
docker-compose down
```

---

### 3. Restart the Application

To restart the application, first stop it (if running) and then start it again:

```bash
docker-compose down
docker-compose up --build
```

---

## Additional Resources

- **AWS Route 53 Policy**: Refer to the `route53-policy.json` file for DNS configuration details.

---

Feel free to explore and modify the project to suit your needs. Happy coding!
