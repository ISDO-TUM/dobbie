# AWS Deployment Guide (Easy & Cheap)

This guide shows you how to deploy your **Dobbie Sovereign Agent** to AWS using a cost-effective EC2 instance with Docker Compose. This approach gives you full performance control for a very low price (approx. $5-10/month depending on usage).

## 1. Prerequisites

- An AWS Account.
- AWS CLI installed (optional, but helpful).

## 2. Launch an EC2 Instance

1.  **Go to EC2 Console** > **Launch Instance**.
2.  **Name**: `dobbie-agent`.
3.  **OS Image**: **Ubuntu Server 24.04 LTS** (AMD64 or ARM64).
    - _Tip_: For maximum savings/performance, choose **ARM64** architecture and use instance type `t4g.small` or `t4g.micro`. Your Docker setup supports this.
    - If you stick with x86 (default), use `t3.small` or `t3.micro`.
4.  **Instance Type**: `t4g.small` (2 vCPUs, 2GB RAM) is recommended.
5.  **Key Pair**: Create a new key pair (e.g., `dobbie-key`) and download the `.pem` file.
6.  **Network Settings**:
    - Create Security Group.
    - **Allow SSH** (Port 22) from your IP.
    - **Allow HTTP** (Port 80) from Anywhere (0.0.0.0/0).
    - **Allow Custom TCP** (Port 3001) from Anywhere (Optional, if you want direct API access).
7.  **Storage**: 8GB gp3 (default) is fine.
8.  **Launch**.

## 3. Connect to Instance

Open your terminal and SSH into the server:

```bash
chmod 400 dobbie-key.pem
ssh -i "dobbie-key.pem" ubuntu@<YOUR-EC2-PUBLIC-IP>
```

## 4. Install Docker & Git

Run these commands on the server:

```bash
# Update packages
sudo apt-get update

# Install Docker
sudo apt-get install -y docker.io docker-compose-v2 git

# Install Node.js and pnpm (Optional, but useful for debugging or fixing lockfiles)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm

# Add user to docker group (avoids using sudo for docker)
sudo usermod -aG docker $USER
newgrp docker
```

## 5. Deploy Application

1.  **Clone your repository** (or copy files via SCP):

    ```bash
    git clone <YOUR_REPO_URL> app
    cd app
    ```

    _Alternatively, copy files from your local machine:_

    ```bash
    # Run this from your local machine
    scp -i "dobbie-key.pem" -r backend frontend compose.yml .env ubuntu@<EC2-IP>:~/app
    ```

2.  **Setup Environment Variables**:
    - Ensure your `.env` file is present in the root folder (`~/app/.env`).
    - Make sure `DEPLOYER_KEY`, `PROPAGATOR_KEY`, etc. are set.

3.  **Start the Application**:
    ```bash
    docker compose up -d --build
    ```

## 6. Access the App

- Open your browser and go to: `http://<YOUR-EC2-PUBLIC-IP>`
- The Frontend should load.
- It will communicate with the Backend via `/api/...`, which Nginx proxies to port 3001 locally.

## Maintenance

- **View Logs**: `docker compose logs -f`
- **Update App**:
  ```bash
  git pull
  docker compose up -d --build
  ```
- **Stop App**: `docker compose down`

## Cost Estimate

- **t4g.small**: ~$0.0168/hour (~$12/month).
- **Spot Instance**: You can request Spot instances for up to 70% discount (~$4/month), but they can be interrupted.
- **Micro Instances**: `t4g.micro` is cheaper (~$6/month) but has less RAM (1GB). Might struggle with build steps but runs compiled app fine.

## Architecture Notes

- **Frontend** is served by Nginx on Port 80.
- **Backend** runs on Port 3001 (internal).
- **Nginx** acts as a Reverse Proxy: Requests to `/api/*` are forwarded to Backend.
- This setup solves CORS issues and simplifies configuration.
