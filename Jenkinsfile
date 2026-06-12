pipeline {
    agent any

    environment {
        IMAGE_NAME  = "ddm501-fe"
        REGISTRY    = "ghcr.io/bui-quang-minh"
        SERVER_IP   = "34.21.135.170"
        SERVER_USER = "khoant16"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                echo "Branch: ${env.BRANCH_NAME}"
            }
        }

        stage('Build Image') {
            steps {
                sh """
                    docker build \
                      --build-arg NEXT_PUBLIC_API_URL=http://${SERVER_IP}:8000 \
                      -t ${REGISTRY}/${IMAGE_NAME}:latest \
                      -t ${REGISTRY}/${IMAGE_NAME}:${env.GIT_COMMIT[0..6]} .
                """
            }
        }

        stage('Push Image') {
            steps {
                withCredentials([string(credentialsId: 'GHCR_TOKEN', variable: 'GHCR_TOKEN')]) {
                    sh "echo ${GHCR_TOKEN} | docker login ghcr.io -u bui-quang-minh --password-stdin"
                    sh "docker push ${REGISTRY}/${IMAGE_NAME}:latest"
                    sh "docker push ${REGISTRY}/${IMAGE_NAME}:${env.GIT_COMMIT[0..6]}"
                }
            }
        }

        stage('Deploy PROD') {
            when { branch 'main' }
            steps {
                sshagent(['SSH_SERVER_KEY']) {
                    sh """
                        ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} '
                            echo \$GHCR_TOKEN | docker login ghcr.io -u bui-quang-minh --password-stdin 2>/dev/null || true
                            docker pull ${REGISTRY}/${IMAGE_NAME}:latest
                            cd /opt/prod
                            docker compose --env-file .env up -d --no-deps frontend
                            docker image prune -f
                            echo "FE PROD deployed"
                        '
                    """
                }
            }
        }
    }

    post {
        success { echo "✅ FE Pipeline ${env.BRANCH_NAME} thanh cong" }
        failure  { echo "❌ FE Pipeline ${env.BRANCH_NAME} that bai" }
    }
}
