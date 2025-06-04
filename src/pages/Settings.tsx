
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, User, Eye } from 'lucide-react';
import MFASettings from '@/components/auth/MFASettings';
import AuditLogs from '@/components/admin/AuditLogs';
import ChatLayout from '@/components/chat/ChatLayout';

const Settings: React.FC = () => {
  return (
    <ChatLayout>
      <div className="container mx-auto py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Settings</h1>
          
          <Tabs defaultValue="security" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="security" className="flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex items-center">
                <User className="h-4 w-4 mr-2" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center">
                <Eye className="h-4 w-4 mr-2" />
                Audit Logs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="security" className="mt-6">
              <MFASettings />
            </TabsContent>

            <TabsContent value="profile" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Profile Settings
                  </CardTitle>
                  <CardDescription>
                    Manage your account information and preferences.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Profile management features coming soon...
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="mt-6">
              <AuditLogs />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ChatLayout>
  );
};

export default Settings;
