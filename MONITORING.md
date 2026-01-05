# MemoLink Monitoring System

A comprehensive, scalable, and efficient real-time monitoring system for the MemoLink application using Prometheus metrics.

## 🚀 Features

### Core Monitoring Capabilities

- **Real-time Metrics Collection**: Automatic collection of HTTP, database, and system metrics
- **Prometheus Integration**: Industry-standard metrics format for easy integration with monitoring tools
- **Health Checks**: Liveness and readiness probes for Kubernetes/container orchestration
- **Performance Tracking**: Request duration, database query performance, and error rates
- **Resource Monitoring**: Memory usage, CPU usage, and event loop lag tracking
- **Business Metrics**: Track entries, goals, tags, and media uploads
- **Beautiful Dashboard**: Real-time web dashboard with auto-refresh

## 📊 Available Metrics

### HTTP Metrics
- `memolink_http_request_duration_seconds` - Request duration histogram
- `memolink_http_requests_total` - Total HTTP requests counter
- `memolink_http_request_errors_total` - Total HTTP errors counter
- `memolink_http_request_size_bytes` - Request size histogram
- `memolink_http_response_size_bytes` - Response size histogram

### Database Metrics
- `memolink_db_query_duration_seconds` - Database query duration histogram
- `memolink_db_queries_total` - Total database queries counter
- `memolink_db_query_errors_total` - Database query errors counter
- `memolink_db_connections_active` - Active database connections gauge

### System Metrics
- `memolink_active_users` - Currently active users gauge
- `memolink_memory_usage_bytes` - Memory usage by type (rss, heap_total, heap_used, external)
- `memolink_cpu_usage_percent` - CPU usage percentage
- `memolink_event_loop_lag_seconds` - Event loop lag

### Business Metrics
- `memolink_entries_created_total` - Total entries created
- `memolink_goals_created_total` - Total goals created
- `memolink_tags_created_total` - Total tags created
- `memolink_media_uploaded_total` - Total media files uploaded

### Cache Metrics
- `memolink_cache_hits_total` - Cache hits counter
- `memolink_cache_misses_total` - Cache misses counter

## 🔗 Endpoints

### Monitoring Endpoints

| Endpoint | Description | Format |
|----------|-------------|--------|
| `/monitoring/dashboard` | Real-time monitoring dashboard | HTML |
| `/monitoring/metrics` | Prometheus metrics | Text (Prometheus format) |
| `/monitoring/metrics/json` | Metrics in JSON format | JSON |
| `/monitoring/health` | Detailed health check | JSON |
| `/monitoring/health/live` | Liveness probe | JSON |
| `/monitoring/health/ready` | Readiness probe | JSON |
| `/monitoring/stats` | Application statistics | JSON |
| `/monitoring/metrics/reset` | Reset all metrics (dev only) | JSON |

## 🎯 Usage

### Accessing the Dashboard

1. Start your server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/monitoring/dashboard
   ```

3. The dashboard will auto-refresh every 5 seconds with the latest metrics.

### Using Metrics in Your Code

#### Track HTTP Requests (Automatic)
The monitoring middleware automatically tracks all HTTP requests. No additional code needed!

#### Track Database Queries

```typescript
import { monitorDbQuery } from '../core/monitoring';

// Wrap your database operations
const users = await monitorDbQuery(
  'find',
  'users',
  () => User.find({ active: true })
);
```

#### Track Business Events

```typescript
import { metricsService } from '../core/monitoring';

// Track entry creation
metricsService.recordEntryCreated(userId);

// Track goal creation
metricsService.recordGoalCreated(userId, 'weekly');

// Track tag creation
metricsService.recordTagCreated(userId);

// Track media upload
metricsService.recordMediaUploaded(userId, 'image');
```

#### Track Cache Operations

```typescript
import { metricsService } from '../core/monitoring';

// Record cache hit
metricsService.recordCacheHit('user_cache');

// Record cache miss
metricsService.recordCacheMiss('user_cache');
```

## 🔧 Integration with External Tools

### Prometheus Setup

1. Add this scrape config to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'memolink'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/monitoring/metrics'
```

2. Start Prometheus and it will automatically scrape your metrics.

### Grafana Dashboard

1. Add Prometheus as a data source in Grafana
2. Import a Node.js dashboard or create custom visualizations using the metrics
3. Example queries:
   - Request rate: `rate(memolink_http_requests_total[5m])`
   - Error rate: `rate(memolink_http_request_errors_total[5m])`
   - P95 latency: `histogram_quantile(0.95, memolink_http_request_duration_seconds)`

### Kubernetes Health Checks

```yaml
livenessProbe:
  httpGet:
    path: /monitoring/health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /monitoring/health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## 📈 Performance Considerations

### Efficiency
- Metrics collection has minimal overhead (< 1ms per request)
- Uses efficient histogram buckets for latency tracking
- Automatic cleanup of old metric data
- Non-blocking metric collection

### Scalability
- Metrics are stored in-memory with efficient data structures
- Supports high-throughput applications
- Can be scraped by multiple Prometheus instances
- Horizontal scaling friendly (metrics per instance)

### Best Practices
- Metrics are automatically normalized (IDs replaced with placeholders)
- Cardinality is controlled to prevent metric explosion
- Slow requests (> 1s) are automatically logged
- Slow database queries (> 500ms) are automatically logged

## 🔒 Security

### Production Recommendations

1. **Protect sensitive endpoints**: Add authentication to `/monitoring/metrics/reset`
2. **Rate limiting**: Consider rate limiting monitoring endpoints
3. **Network isolation**: Expose metrics only to internal monitoring systems
4. **CORS**: Configure CORS appropriately for the dashboard

Example protection:

```typescript
import { authenticate } from '../middleware/auth';

// Protect reset endpoint
router.post('/metrics/reset', authenticate, (req, res) => {
  // ... reset logic
});
```

## 🎨 Dashboard Features

- **Real-time Updates**: Auto-refreshes every 5 seconds
- **System Status**: Overall health indicator
- **Uptime Tracking**: Formatted uptime display
- **Database Status**: Connection state monitoring
- **Memory Usage**: Visual progress bars
- **HTTP Metrics**: Request counts and error rates
- **Database Metrics**: Query counts and error rates
- **System Resources**: Memory breakdown
- **Runtime Info**: Node version, platform, process ID

## 🐛 Troubleshooting

### Dashboard not loading
- Ensure the server is running
- Check that the dashboard file exists at `src/monitoring-dashboard.html`
- Verify CORS settings if accessing from a different origin

### Metrics not appearing
- Wait a few seconds for metrics to be collected
- Make some API requests to generate metrics
- Check browser console for errors

### High memory usage
- This is normal for metric collection
- Metrics are stored in-memory
- Consider implementing metric retention policies for long-running instances

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [prom-client GitHub](https://github.com/siimon/prom-client)
- [Grafana Documentation](https://grafana.com/docs/)

## 🤝 Contributing

When adding new features, consider:
1. Adding relevant metrics
2. Updating the dashboard if needed
3. Documenting new metrics in this README
4. Testing metric collection under load

---

**Built with ❤️ using Prometheus and prom-client**
