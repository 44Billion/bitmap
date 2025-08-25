import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserNickname } from '@/hooks/useUserNickname';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User as UserIcon, Edit2, RotateCcw } from 'lucide-react';

const nicknameSchema = z.object({
  nickname: z.string()
    .min(1, 'Nickname is required')
    .max(50, 'Nickname must be less than 50 characters')
    .trim(),
});

type NicknameFormData = z.infer<typeof nicknameSchema>;

export const UserNicknameEditor: React.FC = () => {
  const { user, metadata } = useCurrentUser();
  const { nickname, setNickname, resetToDefault } = useUserNickname();
  
  const form = useForm<NicknameFormData>({
    resolver: zodResolver(nicknameSchema),
    defaultValues: {
      nickname: nickname || '',
    },
  });

  // Update form when nickname changes
  React.useEffect(() => {
    form.setValue('nickname', nickname || '');
  }, [nickname, form]);

  const onSubmit = (data: NicknameFormData) => {
    setNickname(data.nickname);
  };

  if (!user) {
    return null;
  }

  const defaultNickname = metadata?.name || 'Generated Username';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          Chat Nickname
        </CardTitle>
        <CardDescription>
          Set a custom nickname for chat sessions. This will be used instead of your profile name in ephemeral chats.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Nickname</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter your chat nickname"
                        {...field}
                        className="flex-1"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!form.formState.isDirty || !form.formState.isValid}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetToDefault}
                        disabled={nickname === defaultNickname}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    This nickname will be used in ephemeral chat sessions. Leave empty to use your default name.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              <div className="font-medium mb-1">Current Settings:</div>
              <div className="space-y-1">
                <div>• <strong>Profile Name:</strong> {metadata?.name || 'Not set'}</div>
                <div>• <strong>Chat Nickname:</strong> {nickname || 'Using profile name'}</div>
                <div>• <strong>Default Fallback:</strong> {defaultNickname}</div>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};