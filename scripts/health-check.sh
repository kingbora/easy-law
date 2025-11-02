#!/bin/bash

VERSION=$1
MAX_ATTEMPTS=30
ATTEMPT=1

echo "🏥 Health checking $VERSION services..."

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if [ "$VERSION" = "v2" ]; then
        FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://frontend-v2:3000/api/health || echo "000")
        BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://backend-v2:4000/health || echo "000")
    else
        FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://frontend-v1:3000/api/health || echo "000")
        BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://backend-v1:4000/health || echo "000")
    fi

    if [ "$FRONTEND_HEALTH" = "200" ] && [ "$BACKEND_HEALTH" = "200" ]; then
        echo "✅ $VERSION services are healthy"
        return 0
    fi

    echo "⏳ Attempt $ATTEMPT/$MAX_ATTEMPTS - Frontend: $FRONTEND_HEALTH, Backend: $BACKEND_HEALTH"
    sleep 5
    ATTEMPT=$((ATTEMPT + 1))
done

echo "❌ Health check failed for $VERSION services"
exit 1