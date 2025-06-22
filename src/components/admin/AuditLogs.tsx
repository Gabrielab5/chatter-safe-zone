
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AuditLog {
  id: string;
  user_id: string;
  event_type: string;
  event_data: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string;
  };
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    eventType: 'all',
    userId: '',
    startDate: '',
    endDate: ''
  });

  const { toast } = useToast();

  useEffect(() => {
    loadAuditLogs();
  }, [pagination.page, filters]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.eventType !== 'all' && { eventType: filters.eventType }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      });

      const response = await supabase.functions.invoke('audit-logs', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.error) {
        throw response.error;
      }

      const data: AuditLogsResponse = response.data;
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 0 });
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load audit logs. You may not have admin privileges.",
        variant: "destructive",
      });
      // Set empty state on error
      setLogs([]);
      setPagination({ page: 1, limit: 50, total: 0, pages: 0 });
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'login_success':
        return 'bg-green-100 text-green-800';
      case 'login_failed':
        return 'bg-red-100 text-red-800';
      case 'mfa_enabled':
      case 'mfa_success':
        return 'bg-blue-100 text-blue-800';
      case 'mfa_failed':
      case 'mfa_disabled':
        return 'bg-yellow-100 text-yellow-800';
      case 'message_sent':
        return 'bg-purple-100 text-purple-800';
      case 'file_uploaded':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatEventData = (data: any) => {
    if (!data) return 'N/A';
    return JSON.stringify(data, null, 2).slice(0, 100) + '...';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Eye className="h-5 w-5 mr-2" />
          Audit Logs
        </CardTitle>
        <CardDescription>
          View security events and user activities across the platform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="eventType">Event Type</Label>
            <Select
              value={filters.eventType}
              onValueChange={(value) => setFilters(prev => ({ ...prev, eventType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="login_success">Login Success</SelectItem>
                <SelectItem value="login_failed">Login Failed</SelectItem>
                <SelectItem value="mfa_enabled">MFA Enabled</SelectItem>
                <SelectItem value="mfa_disabled">MFA Disabled</SelectItem>
                <SelectItem value="mfa_success">MFA Success</SelectItem>
                <SelectItem value="mfa_failed">MFA Failed</SelectItem>
                <SelectItem value="message_sent">Message Sent</SelectItem>
                <SelectItem value="file_uploaded">File Uploaded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="userId">User ID</Label>
            <Input
              id="userId"
              placeholder="Filter by user ID"
              value={filters.userId}
              onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
            />
          </div>
        </div>

        <Button onClick={loadAuditLogs} className="mb-4" disabled={loading}>
          <Filter className="h-4 w-4 mr-2" />
          Apply Filters
        </Button>

        {/* Logs Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Event Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {log.profiles?.full_name || 'Unknown User'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.profiles?.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getEventTypeColor(log.event_type)}>
                        {log.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.ip_address || 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      <pre className="text-xs text-muted-foreground">
                        {formatEventData(log.event_data)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {logs.length} of {pagination.total} entries
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditLogs;
