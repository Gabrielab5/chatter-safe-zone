
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserPresence } from '@/types/userPresence';

interface User {
  id: string;
  name: string;
  avatar_url?: string;
}

interface GroupCreationModalProps {
  onlineUsers: UserPresence[];
  onCreateGroup: (groupName: string, selectedUserIds: string[]) => Promise<void>;
}

const GroupCreationModal: React.FC<GroupCreationModalProps> = ({
  onlineUsers,
  onCreateGroup
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a group name",
        variant: "destructive"
      });
      return;
    }

    if (selectedUsers.length === 0) {
      toast({
        title: "Error", 
        description: "Please select at least one user to add to the group",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      await onCreateGroup(groupName.trim(), selectedUsers);
      setIsOpen(false);
      setGroupName('');
      setSelectedUsers([]);
      toast({
        title: "Success",
        description: `Group "${groupName}" created successfully`
      });
    } catch (error) {
      console.error('Failed to create group:', error);
      toast({
        title: "Error",
        description: "Failed to create group. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Create Group Chat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Create Group Chat
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="groupName">Group Name</Label>
            <Input
              id="groupName"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
          </div>
          
          <div>
            <Label>Select Members ({selectedUsers.length} selected)</Label>
            <div className="max-h-48 overflow-y-auto border rounded-md mt-2">
              {onlineUsers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No other users available
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {onlineUsers.map((user) => (
                    <div key={user.user_id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                      <Checkbox
                        id={user.user_id}
                        checked={selectedUsers.includes(user.user_id)}
                        onCheckedChange={() => handleUserToggle(user.user_id)}
                      />
                      <div className="flex items-center flex-1">
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium mr-3">
                          {user.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{user.full_name || 'Unknown User'}</p>
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-1 ${user.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <span className="text-xs text-muted-foreground">
                              {user.is_online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={isCreating}>
              {isCreating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              Create Group
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupCreationModal;
