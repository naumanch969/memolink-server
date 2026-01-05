# Quick Start Guide - Monitoring System

## 🚀 Getting Started

Your monitoring system is now live and collecting metrics!

### Access the Dashboard

Open your browser and navigate to:
```
http://localhost:5001/monitoring/dashboard
```

You'll see a beautiful real-time dashboard with:
- ✅ System health status
- 📊 HTTP request metrics
- 💾 Database query metrics
- 💻 System resource usage
- ⚙️ Runtime information

The dashboard auto-refreshes every 5 seconds!

---

## 📊 Available Endpoints

### 1. **Real-Time Dashboard** (For Humans)
```
GET http://localhost:5001/monitoring/dashboard
```
Beautiful web interface with live metrics

### 2. **Prometheus Metrics** (For Monitoring Tools)
```
GET http://localhost:5001/monitoring/metrics
```
Returns metrics in Prometheus format:
```
# HELP memolink_http_requests_total Total number of HTTP requests
# TYPE memolink_http_requests_total counter
memolink_http_requests_total{method="GET",route="/api/entries",status_code="200"} 42
```

### 3. **Health Check** (For Load Balancers)
```
GET http://localhost:5001/monitoring/health
```
Returns:
```json
{
  "status": "healthy",
  "uptime": { "formatted": "16m 51s" },
  "memory": { "heapUsedPercentage": "96.10%" },
  "database": { "connected": true }
}
```

### 4. **Statistics** (For Dashboards)
```
GET http://localhost:5001/monitoring/stats
```
Returns:
```json
{
  "http": {
    "totalRequests": 15,
    "totalErrors": 2,
    "errorRate": "13.33%"
  },
  "database": {
    "totalQueries": 0,
    "errorRate": "0%"
  }
}
```

### 5. **Liveness Probe** (For Kubernetes)
```
GET http://localhost:5001/monitoring/health/live
```
Returns 200 if server is running

### 6. **Readiness Probe** (For Kubernetes)
```
GET http://localhost:5001/monitoring/health/ready
```
Returns 200 if server is ready to accept traffic

---

## 💡 Quick Integration Examples

### Track Database Queries
```typescript
import { monitorDbQuery } from '../core/monitoring';

// Wrap any database operation
const users = await monitorDbQuery(
  'find',
  'users',
  () => User.find({ active: true })
);
```

### Track Business Events
```typescript
import { metricsService } from '../core/monitoring';

// Track when users create entries
metricsService.recordEntryCreated(userId);

// Track when users create goals
metricsService.recordGoalCreated(userId, 'weekly');

// Track media uploads
metricsService.recordMediaUploaded(userId, 'image');
```

### Track Cache Operations
```typescript
import { metricsService } from '../core/monitoring';

if (cache.has(key)) {
  metricsService.recordCacheHit('user_cache');
  return cache.get(key);
} else {
  metricsService.recordCacheMiss('user_cache');
  // fetch from database...
}
```

---

## 🔍 Testing the Monitoring System

### 1. View Current Metrics
```bash
curl http://localhost:5001/monitoring/stats | jq .
```

### 2. Check System Health
```bash
curl http://localhost:5001/monitoring/health | jq .
```

### 3. View Prometheus Metrics
```bash
curl http://localhost:5001/monitoring/metrics | head -50
```

### 4. Generate Some Traffic
```bash
# Make some API requests to see metrics change
curl http://localhost:5001/api/health
curl http://localhost:5001/api/entries
```

Then refresh the dashboard to see the metrics update!

---

## 📈 What's Being Monitored

### Automatically Tracked
- ✅ All HTTP requests (duration, status, errors)
- ✅ System resources (CPU, memory, event loop)
- ✅ Node.js internals (GC, heap, handles)

### Track Manually
- 📝 Database queries (wrap with `monitorDbQuery`)
- 📝 Business events (call `metricsService.record*`)
- 📝 Cache operations (call `metricsService.recordCache*`)

---

## 🎯 Next Steps

1. **Open the dashboard**: `http://localhost:5001/monitoring/dashboard`
2. **Make some API requests** to generate metrics
3. **Watch the metrics update** in real-time
4. **Integrate monitoring** into your services (see MONITORING.md)
5. **Set up Prometheus** for long-term storage (optional)
6. **Create Grafana dashboards** for advanced visualization (optional)

---

## 📚 Full Documentation

For complete documentation, see:
- **MONITORING.md** - Comprehensive guide
- **MONITORING_IMPLEMENTATION.md** - Implementation details

---

## 🎉 You're All Set!

Your monitoring system is:
- ✅ Collecting metrics automatically
- ✅ Tracking system health
- ✅ Ready for production use
- ✅ Scalable and efficient
- ✅ Real-time and beautiful

**Enjoy your new monitoring system!** 🚀
