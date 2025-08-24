// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useRef, useState, useEffect } from 'react';
import { nip19 } from 'nostr-tools';
import { Shield, KeyRound, User as UserIcon, Edit2, X, Activity, Download, Copy, CheckCircle, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useEphemeralIdentity } from '@/hooks/useEphemeralIdentity';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  _onSignup?: () => void;
}

const validateNsec = (nsec: string) => {
  return /^nsec1[a-zA-Z0-9]{58}$/.test(nsec);
};

const validateBunkerUri = (uri: string) => {
  return uri.startsWith('bunker://');
};

const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onClose, onLogin, _onSignup }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const [bunkerUri, setBunkerUri] = useState('');
  const [errors, setErrors] = useState<{
    nsec?: string;
    bunker?: string;
    extension?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const login = useLoginActions();
  const { identity, updateNickname, generateIdentity, clearIdentity } = useEphemeralIdentity();
  const { user } = useCurrentUser();
  const { currentUser, removeLogin } = useLoggedInAccounts();
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [ephemeralKeySecured, setEphemeralKeySecured] = useState<'none' | 'copied' | 'downloaded'>('none');

  // Reset all state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens
      setIsLoading(false);
      setNsec('');
      setBunkerUri('');
      setErrors({});
      setIsEditingNickname(false);
      setNewNickname('');
      setEphemeralKeySecured('none');
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  // Handle nickname editing
  const handleStartEditNickname = () => {
    if (identity) {
      setNewNickname(identity.nickname);
      setIsEditingNickname(true);
    }
  };

  const handleSaveNickname = () => {
    if (newNickname.trim() && identity) {
      updateNickname(newNickname.trim());
      setIsEditingNickname(false);
    }
  };

  const handleCancelEditNickname = () => {
    setIsEditingNickname(false);
    setNewNickname('');
  };

  // Ephemeral key management
  const copyEphemeralKey = () => {
    if (identity?.privateKey) {
      const nsec = nip19.nsecEncode(identity.privateKey);
      navigator.clipboard.writeText(nsec);
      setEphemeralKeySecured('copied');
    }
  };

  const downloadEphemeralKey = () => {
    if (identity?.privateKey) {
      try {
        const nsec = nip19.nsecEncode(identity.privateKey);
        const blob = new Blob([nsec], { type: 'text/plain; charset=utf-8' });
        const url = globalThis.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ephemeral-key-${identity.nickname}.txt`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        globalThis.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setEphemeralKeySecured('downloaded');
      } catch {
        // Silently fail download
      }
    }
  };

  const handleGenerateEphemeral = () => {
    const newIdentity = generateIdentity();
    if (newIdentity) {
      setEphemeralKeySecured('none');
    }
  };

  // Check if current user is using ephemeral identity vs regular login
  const isEphemeralUser = !user && currentUser;

  // Clear ephemeral identity function
  const clearEphemeralIdentity = () => {
    // Remove the current login
    if (currentUser) {
      removeLogin(currentUser.id);
    }
    // Clear the identity using the hook's clearIdentity function
    clearIdentity();
    // Close the dialog
    onClose();
  };

  // Clear ephemeral identity without login (for when identity exists but currentUser doesn't)
  const clearEphemeralIdentityOnly = () => {
    // Clear the identity using the hook's clearIdentity function
    clearIdentity();
    // Close the dialog
    onClose();
  };

  // Logout function for regular users
  const handleLogout = () => {
    if (currentUser) {
      removeLogin(currentUser.id);
    }
    // Close the dialog
    onClose();
  };

  const handleExtensionLogin = async () => {
    setIsLoading(true);
    setErrors(prev => ({ ...prev, extension: undefined }));

    try {
      if (!('nostr' in window)) {
        throw new Error('Nostr extension not found. Please install a NIP-07 extension.');
      }
      await login.extension();
      onLogin();
      onClose();
    } catch (e: unknown) {
      const error = e as Error;
      console.error('Bunker login failed:', error);
      console.error('Nsec login failed:', error);
      console.error('Extension login failed:', error);
      setErrors(prev => ({
        ...prev,
        extension: error instanceof Error ? error.message : 'Extension login failed'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const executeLogin = (key: string) => {
    setIsLoading(true);
    setErrors({});

    // Use a timeout to allow the UI to update before the synchronous login call
    setTimeout(() => {
      try {
        login.nsec(key);
        onLogin();
        onClose();
      } catch {
        setErrors({ nsec: "Failed to login with this key. Please check that it's correct." });
        setIsLoading(false);
      }
    }, 50);
  };

  const handleKeyLogin = () => {
    if (!nsec.trim()) {
      setErrors(prev => ({ ...prev, nsec: 'Please enter your secret key' }));
      return;
    }

    if (!validateNsec(nsec)) {
      setErrors(prev => ({ ...prev, nsec: 'Invalid secret key format. Must be a valid nsec starting with nsec1.' }));
      return;
    }
    executeLogin(nsec);
  };

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim()) {
      setErrors(prev => ({ ...prev, bunker: 'Please enter a bunker URI' }));
      return;
    }

    if (!validateBunkerUri(bunkerUri)) {
      setErrors(prev => ({ ...prev, bunker: 'Invalid bunker URI format. Must start with bunker://' }));
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, bunker: undefined }));

    try {
      await login.bunker(bunkerUri);
      onLogin();
      onClose();
      // Clear the URI from memory
      setBunkerUri('');
    } catch {
      setErrors(prev => ({
        ...prev,
        bunker: 'Failed to connect to bunker. Please check the URI.'
      }));
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-black border border-green-500/30 flex flex-col">
        <DialogHeader className="border-b border-green-500/20 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-green-400 font-mono text-md">
              <Activity className="h-3 w-3" />
              IDENTITY TERMINAL
            </DialogTitle>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-green-500 hover:text-green-400 hover:bg-green-500/20 rounded-sm"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400 font-mono">
            <div className="flex items-center gap-1">
              <UserIcon className="h-3 w-3 text-yellow-400" />
              {currentUser ? (
                isEphemeralUser ? (
                  identity && (isEditingNickname ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') handleSaveNickname();
                          if (e.key === 'Escape') handleCancelEditNickname();
                        }}
                        placeholder="New nickname..."
                        className="h-6 text-xs bg-black/50 border-green-500/30 text-green-400 placeholder:text-green-500/50 font-mono w-32"
                        autoFocus
                      />
                      <Button
                        onClick={handleSaveNickname}
                        size="sm"
                        className="h-6 w-6 bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-400 p-0"
                      >
                        ✓
                      </Button>
                      <Button
                        onClick={handleCancelEditNickname}
                        size="sm"
                        className="h-6 w-6 bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-400 p-0"
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartEditNickname}
                      className="text-yellow-300 hover:text-yellow-200 transition-colors flex items-center gap-1"
                    >
                      Ephemeral: {identity.nickname}
                      <Edit2 className="h-3 w-3" />
                    </button>
                  ))
                ) : (
                  <span className="text-blue-300">
                    {currentUser.metadata.name || currentUser.pubkey.slice(0, 8)}...
                  </span>
                )
              ) : identity ? (
                isEditingNickname ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newNickname}
                      onChange={(e) => setNewNickname(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleSaveNickname();
                        if (e.key === 'Escape') handleCancelEditNickname();
                      }}
                      placeholder="New nickname..."
                      className="h-6 text-xs bg-black/50 border-green-500/30 text-green-400 placeholder:text-green-500/50 font-mono w-32"
                      autoFocus
                    />
                    <Button
                      onClick={handleSaveNickname}
                      size="sm"
                      className="h-6 w-6 bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-400 p-0"
                    >
                      ✓
                    </Button>
                    <Button
                      onClick={handleCancelEditNickname}
                      size="sm"
                      className="h-6 w-6 bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-400 p-0"
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={handleStartEditNickname}
                    className="text-yellow-300 hover:text-yellow-200 transition-colors flex items-center gap-1"
                  >
                    Ephemeral: {identity.nickname}
                    <Edit2 className="h-3 w-3" />
                  </button>
                )
              ) : (
                <span className="text-gray-500">No identity</span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 pb-4 space-y-4">
          {/* Show current user status and actions */}
          {currentUser ? (
            <>
              {/* User is logged in - show identity info and action button */}
              <div className="space-y-4">
                <div className="text-cyan-400 py-2 w-full font-mono text-xs leading-relaxed">
                  <span>[STATUS] </span>
                  {isEphemeralUser ? (
                    <span>Ephemeral identity active: {currentUser.metadata.name || currentUser.pubkey.slice(0, 8)}...</span>
                  ) : (
                    <span>Authenticated as: {currentUser.metadata.name || currentUser.pubkey.slice(0, 8)}...</span>
                  )}
                </div>

                {/* Action button */}
                <div className="pt-2">
                  {isEphemeralUser ? (
                    <Button
                      onClick={clearEphemeralIdentity}
                      className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 font-mono text-xs py-3"
                    >
                      <X className="w-3 h-3 mr-2" />
                      [CLEAR IDENTITY]
                    </Button>
                  ) : (
                    <Button
                      onClick={handleLogout}
                      className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 font-mono text-xs py-3"
                    >
                      <X className="w-3 h-3 mr-2" />
                      [LOG OUT]
                    </Button>
                  )}
                </div>

                {/* Additional options */}
                <div className="pt-4 border-t border-green-500/20">
                  <div className="text-gray-500 py-2 w-full font-mono text-xs leading-relaxed">
                    <span>[INFO] </span>
                    {isEphemeralUser ? (
                      <span>Clearing identity will remove your ephemeral session and generated keys.</span>
                    ) : (
                      <span>Logging out will end your authenticated session.</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : identity ? (
            <>
              {/* Ephemeral identity exists */}
              <div className="space-y-4">
                <div className="text-gray-500 pb-2 w-full font-mono text-xs leading-relaxed">
                  <span>[INFO] </span>
                  <span>Ephemeral identities are temporary and session-based. Secure your key if you want to reuse it later.</span>
                </div>

                {/* Key management options */}
                <div className="space-y-2">
                  {/* Copy Option */}
                  <Card className={`cursor-pointer transition-all duration-200 ${
                    ephemeralKeySecured === 'copied'
                       ? 'border-green-500/50 bg-green-500/10'
                       : 'border-green-500/20 hover:bg-green-500/10'
                   }`}>
                    <CardContent className='p-3'>
                      <Button
                        variant="ghost"
                        className='w-full h-auto p-0 justify-start hover:bg-transparent'
                        onClick={copyEphemeralKey}
                      >
                        <div className='flex items-center gap-3 w-full'>
                          <div className={`p-1.5 rounded-lg ${
                            ephemeralKeySecured === 'copied'
                               ? 'bg-green-500/20'
                               : 'bg-green-500/10'
                           }`}>
                            {ephemeralKeySecured === 'copied' ? (
                               <CheckCircle className='w-4 h-4 text-green-400' />
                             ) : (
                               <Copy className='w-4 h-4 text-green-400' />
                             )}
                          </div>
                          <div className='flex-1 text-left'>
                             <div className='font-medium text-sm text-green-300'>
                               Copy Ephemeral Key
                             </div>
                             <div className='text-xs text-gray-400'>
                               Save to password manager
                            </div>
                            <div className='text-[.7rem] text-gray-500 font-mono'>
                              {nip19.nsecEncode(identity.privateKey).slice(0,16)}...
                            </div>
                          </div>
                          {ephemeralKeySecured === 'copied' && (
                             <div className='text-xs font-medium text-green-400'>
                               ✓ COPIED
                             </div>
                           )}
                        </div>
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Download Option */}
                  <Card className={`cursor-pointer transition-all duration-200 ${
                    ephemeralKeySecured === 'downloaded'
                       ? 'border-green-500/50 bg-green-500/10'
                       : 'border-green-500/20 hover:bg-green-500/10'
                   }`}>
                    <CardContent className='p-3'>
                      <Button
                        variant="ghost"
                        className='w-full h-auto p-0 justify-start hover:bg-transparent'
                        onClick={downloadEphemeralKey}
                      >
                        <div className='flex items-center gap-3 w-full'>
                          <div className={`p-1.5 rounded-lg ${
                            ephemeralKeySecured === 'downloaded'
                               ? 'bg-green-500/20'
                               : 'bg-green-500/10'
                           }`}>
                            {ephemeralKeySecured === 'downloaded' ? (
                               <CheckCircle className='w-4 h-4 text-green-400' />
                             ) : (
                               <Download className='w-4 h-4 text-green-400' />
                             )}
                          </div>
                          <div className='flex-1 text-left'>
                             <div className='font-medium text-sm text-green-300'>
                               Download Ephemeral Key
                             </div>
                             <div className='text-xs text-gray-400'>
                               Save as text file for later reuse
                             </div>
                          </div>
                          {ephemeralKeySecured === 'downloaded' && (
                             <div className='text-xs font-medium text-green-400'>
                               ✓ DOWNLOADED
                             </div>
                           )}
                        </div>
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Clear identity button */}
                <div className="pt-4">
                  <Button
                    onClick={clearEphemeralIdentityOnly}
                    className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 font-mono text-xs py-3"
                  >
                    <X className="w-3 h-3 mr-2" />
                    [CLEAR IDENTITY]
                  </Button>
                </div>

                {/* Generate new identity */}
                <div className="pt-4 border-t border-green-500/20">
                  <div className="text-gray-500 py-2 w-full font-mono text-xs mb-3">
                    <span>[INFO] </span>
                    <span>Need a fresh identity? Generate new ephemeral key.</span>
                  </div>
                  <Button
                    onClick={handleGenerateEphemeral}
                    className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 font-mono text-xs py-3"
                  >
                    <UserIcon className="w-3 h-3 mr-2" />
                    [GENERATE NEW IDENTITY]
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* No identity - show generate ephemeral and login options */}
              <div className="space-y-4">
                <div className="text-green-500 py-2 w-full font-mono text-xs">
                  <span>[INFO] </span>
                  <span>No ephemeral identity detected. Generate one to get started.</span>
                </div>

                <Button
                  onClick={handleGenerateEphemeral}
                  className="w-full bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-400 font-mono text-xs py-3"
                >
                  <UserIcon className="w-3 h-3 mr-2" />
                  [GENERATE EPHEMERAL IDENTITY]
                </Button>
              </div>

              {/* Traditional login options */}
              <div className="pt-4 border-t border-green-500/20">
                <div className="text-gray-500 py-2 w-full font-mono text-xs mb-3">
                  <span>[INFO] </span>
                  <span>Or authenticate with existing Nostr identity.</span>
                </div>

                <Tabs defaultValue={'nostr' in window ? 'extension' : 'key'} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-black/50 border border-green-500/30 rounded-lg mb-4 p-1">
                    <TabsTrigger value="extension" className="flex items-center gap-2 text-xs bg-transparent data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
                      <Shield className="w-3 h-3" />
                      <span>EXT</span>
                    </TabsTrigger>
                    <TabsTrigger value="key" className="flex items-center gap-2 text-xs bg-transparent data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
                      <KeyRound className="w-3 h-3" />
                      <span>KEY</span>
                    </TabsTrigger>
                    <TabsTrigger value="bunker" className="flex items-center gap-2 text-xs bg-transparent data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
                      <Cloud className="w-3 h-3" />
                      <span>BUNK</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value='extension' className='space-y-3'>
                    {errors.extension && (
                      <div className="text-red-500 py-2 w-full font-mono text-xs">
                        <span>[ERROR] </span>
                        <span>{errors.extension}</span>
                      </div>
                    )}
                    <Button
                      className="w-full bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-400 font-mono text-xs py-3"
                      onClick={handleExtensionLogin}
                      disabled={isLoading}
                    >
                      {isLoading ? '[AUTHENTICATING...]' : '[EXTENSION LOGIN]'}
                    </Button>
                  </TabsContent>

                  <TabsContent value='key' className='space-y-3'>
                    <div className='space-y-2'>
                      <Input
                        id='nsec'
                        type="password"
                        value={nsec}
                        onChange={(e) => {
                          setNsec(e.target.value);
                          if (errors.nsec) setErrors(prev => ({ ...prev, nsec: undefined }));
                        }}
                        className={`bg-black/50 border-green-500/30 text-green-400 placeholder:text-green-500/50 font-mono text-xs ${
                          errors.nsec ? 'border-red-500' : ''
                        }`}
                        placeholder='nsec1...'
                        autoComplete="off"
                      />
                      {errors.nsec && (
                        <div className="text-red-500 py-1 w-full font-mono text-xs">
                          <span>[ERROR] </span>
                          <span>{errors.nsec}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-400 font-mono text-xs py-3"
                      onClick={handleKeyLogin}
                      disabled={isLoading || !nsec.trim()}
                    >
                      {isLoading ? '[VERIFYING...]' : '[AUTHENTICATE]'}
                    </Button>
                  </TabsContent>

                  <TabsContent value='bunker' className='space-y-3'>
                    <div className='space-y-2'>
                      <Input
                        id='bunkerUri'
                        value={bunkerUri}
                        onChange={(e) => {
                          setBunkerUri(e.target.value);
                          if (errors.bunker) setErrors(prev => ({ ...prev, bunker: undefined }));
                        }}
                        className={`bg-black/50 border-green-500/30 text-green-400 placeholder:text-green-500/50 font-mono text-xs ${
                          errors.bunker ? 'border-red-500' : ''
                        }`}
                        placeholder='bunker://'
                        autoComplete="off"
                      />
                      {errors.bunker && (
                        <div className="text-red-500 py-1 w-full font-mono text-xs">
                          <span>[ERROR] </span>
                          <span>{errors.bunker}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-400 font-mono text-xs py-3"
                      onClick={handleBunkerLogin}
                      disabled={isLoading || !bunkerUri.trim()}
                    >
                      {isLoading ? '[CONNECTING...]' : '[BUNKER LOGIN]'}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
  };

export default LoginDialog;
