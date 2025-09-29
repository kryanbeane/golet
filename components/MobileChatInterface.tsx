"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  MessageSquare,
  X,
  Send,
  Search,
  Building2,
  Home,
  ArrowLeft,
  Menu,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useToast } from '@/components/ui/use-toast'
import { format } from 'date-fns'
import { cn } from '@/utils/cn'

interface ChatTab {
  id: string
  applicationId: string
  title: string
  isOpen: boolean
  unreadCount: number
  otherPartyName: string
  propertyName: string
  role: 'applicant' | 'owner'
  applicationStatus: string
  lastMessage?: string
  lastMessageTime?: string
  propertyId?: string
}

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  read_at?: string | null
  sender?: {
    id: string
    full_name?: string
    avatar_url?: string | null
  }
}

interface ChatRoom {
  id: string
  application_id: string
  owner_id: string
  applicant_id: string
  application: {
    id: string
    status: string
    listing: {
      id: string
      property_name: string
      address: string
    }
  }
  owner: {
    id: string
    full_name: string
    avatar_url?: string
  }
  applicant: {
    id: string
    full_name: string
    avatar_url?: string
  }
}

interface GroupedConversation {
  id: string
  title: string
  type: 'property' | 'application'
  conversations: ChatTab[]
  totalUnread: number
  lastActivity: string
  status?: string
}

interface MobileChatInterfaceProps {
  onUnreadCountChange?: (count: number) => void
}

export default function MobileChatInterface({ onUnreadCountChange }: MobileChatInterfaceProps) {
  // State management
  const [chatTabs, setChatTabs] = useState<ChatTab[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [newMessages, setNewMessages] = useState<Record<string, string>>({})
  const [chatRooms, setChatRooms] = useState<Record<string, ChatRoom>>({})
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'properties' | 'applications'>('properties')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  // Refs and hooks
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])
  const roomChannelsRef = useRef<Record<string, any>>({})
  const messageEndRef = useRef<HTMLDivElement>(null)
  const loadedRoomsRef = useRef<Set<string>>(new Set())

  const currentUser = user?.id || null

  // Calculate total unread count
  const totalUnreadCount = useMemo(() => {
    return chatTabs.reduce((total, tab) => total + (tab.unreadCount || 0), 0)
  }, [chatTabs])

  // Notify parent of unread count changes
  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(totalUnreadCount)
    }
  }, [totalUnreadCount, onUnreadCountChange])

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, selectedApplicationId])

  // Calculate unread count for a specific chat room
  const calculateUnreadCount = useCallback(async (applicationId: string, currentUserId: string) => {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUserId)
        .eq('type', 'message')
        .eq('data->>application_id', applicationId)

      if (error) {
        console.error('Error counting notifications:', error)
        return 0
      }

      return count || 0
    } catch (error) {
      console.error('Error calculating unread count:', error)
      return 0
    }
  }, [supabase])

  // Fetch user's active applications and chat rooms
  const fetchActiveApplications = useCallback(async (): Promise<ChatTab[]> => {
    if (!currentUser) return []

    try {
      const [{ data: applicantApps, error: applicantError }, { data: ownedListings, error: listingsError }] = await Promise.all([
        supabase
          .from('applications')
          .select('id,status,user_id,listing_id')
          .in('status', ['pending', 'accepted', 'rejected', 'withdrawn'])
          .eq('user_id', currentUser),
        supabase
          .from('listings')
          .select('id, user_id, property_name, address')
          .eq('user_id', currentUser)
      ])

      if (applicantError || listingsError) {
        console.error('Error fetching data:', { applicantError, listingsError })
      }

      let ownerApps: any[] = []
      const ownedListingIds = (ownedListings || []).map((l: any) => l.id)
      if (ownedListingIds.length > 0) {
        const { data: ownerAppsData, error: ownerError } = await supabase
          .from('applications')
          .select('id,status,user_id,listing_id')
          .in('status', ['pending', 'accepted', 'rejected', 'withdrawn'])
          .in('listing_id', ownedListingIds)

        if (ownerError) {
          console.error('Error fetching owner applications:', ownerError)
        }
        ownerApps = ownerAppsData || []
      }

      const allApps = [...(applicantApps || []), ...ownerApps]
      if (allApps.length === 0) return []

      // Get chat rooms for all applications
      const chatRoomPromises = allApps.map(async (app) => {
        try {
          const response = await fetch(`/api/chat/rooms/${app.id}`)
          const data = await response.json()
          if (data.error) return null
          return { applicationId: app.id, chatRoom: data.chatRoom }
        } catch (error) {
          console.error('Error fetching chat room for app:', app.id, error)
          return null
        }
      })

      const chatRoomResults = await Promise.all(chatRoomPromises)
      const validChatRooms = chatRoomResults.filter(result => result !== null)

      // Create tabs with unread counts
      const newTabsPromises = validChatRooms.map(async ({ applicationId, chatRoom }) => {
        const isOwner = chatRoom.owner_id === currentUser
        const otherPartyName = isOwner
          ? (chatRoom.applicant?.full_name || 'New Applicant')
          : (chatRoom.owner?.full_name || 'Property Owner')
        const propertyName = chatRoom.application?.listing?.property_name || 'Property'
        const unreadCount = await calculateUnreadCount(applicationId, currentUser)

        return {
          id: `tab-${applicationId}`,
          applicationId,
          title: `${otherPartyName} - ${propertyName}`,
          isOpen: false,
          unreadCount,
          otherPartyName,
          propertyName,
          role: (isOwner ? 'owner' : 'applicant') as 'owner' | 'applicant',
          applicationStatus: chatRoom.application?.status || 'pending',
          propertyId: chatRoom.application?.listing?.id
        }
      })

      const finalTabs = await Promise.all(newTabsPromises)

      // Update chat rooms state
      validChatRooms.forEach(({ applicationId, chatRoom }) => {
        setChatRooms(prev => ({
          ...prev,
          [applicationId]: chatRoom
        }))
      })

      return finalTabs
    } catch (error) {
      console.error('Error in fetchActiveApplications:', error)
      return []
    }
  }, [currentUser, calculateUnreadCount, supabase])

  // Load applications when user changes
  useEffect(() => {
    if (currentUser) {
      fetchActiveApplications().then(tabs => {
        setChatTabs(tabs)
      })
    } else {
      setChatTabs([])
    }
  }, [currentUser, fetchActiveApplications])

  // Load messages for a specific room
  const loadMessagesForRoom = useCallback(async (roomId: string) => {
    if (loadedRoomsRef.current.has(roomId)) {
      return
    }

    loadedRoomsRef.current.add(roomId)

    try {
      const response = await fetch(`/api/chat/messages/${roomId}`)
      const data = await response.json()
      if (data.messages && data.messages.length > 0) {
        setMessages(prev => ({
          ...prev,
          [roomId]: data.messages
        }))
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }, [])

  // Subscribe to room for real-time updates
  const subscribeToRoom = useCallback((roomId: string) => {
    if (!roomId || roomChannelsRef.current[roomId]) return

    const channel = supabase
      .channel(`messages-room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_room_id=eq.${roomId}` },
        async (payload) => {
          const newMessage = payload.new as any

          setMessages(prev => {
            const existing = prev[roomId] || []
            if (existing.some(m => m.id === newMessage.id)) return prev

            const updatedMessages = [...existing, { ...newMessage }]

            // Enrich sender in background
            if (!newMessage.sender) {
              void supabase
                .from('users')
                .select('id, full_name, avatar_url')
                .eq('id', newMessage.sender_id)
                .single()
                .then(({ data: sender, error }) => {
                  if (error) return
                  if (sender) {
                    setMessages(prev => {
                      const current = prev[roomId] || []
                      return {
                        ...prev,
                        [roomId]: current.map(m =>
                          m.id === newMessage.id
                            ? { ...m, sender: { id: sender.id, full_name: sender.full_name ?? undefined, avatar_url: sender.avatar_url ?? undefined } }
                            : m
                        )
                      }
                    })
                  }
                })
            }

            return {
              ...prev,
              [roomId]: updatedMessages
            }
          })

          // Update unread count if message is from someone else
          if (newMessage.sender_id !== currentUser) {
            const applicationId = Object.keys(chatRooms).find(key =>
              chatRooms[key].id === roomId
            )

            if (applicationId) {
              setChatTabs(prev => prev.map(tab => {
                if (tab.applicationId === applicationId) {
                  return {
                    ...tab,
                    unreadCount: tab.unreadCount + 1,
                    lastMessage: newMessage.content,
                    lastMessageTime: newMessage.created_at
                  }
                }
                return tab
              }))
            }
          }
        }
      )
      .subscribe()

    roomChannelsRef.current[roomId] = channel
  }, [supabase, currentUser, chatRooms])

  // Send message
  const sendMessage = useCallback(async (applicationId: string) => {
    const messageContent = newMessages[applicationId]?.trim()
    if (!messageContent || sending) return

    const chatRoom = chatRooms[applicationId]
    if (!chatRoom) return

    setSending(true)
    try {
      const response = await fetch(`/api/chat/messages/${chatRoom.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent })
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setNewMessages(prev => ({
        ...prev,
        [applicationId]: ''
      }))

    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }, [newMessages, chatRooms, sending, toast])

  // Open chat
  const openChat = useCallback(async (applicationId: string) => {
    if (!currentUser) return

    const chatRoom = chatRooms[applicationId]
    if (!chatRoom) return

    setSelectedApplicationId(applicationId)
    setIsPanelOpen(true)

    // Load messages if needed
    if (!messages[chatRoom.id] || messages[chatRoom.id].length === 0) {
      await loadMessagesForRoom(chatRoom.id)
    }

    // Mark as read and clear unread count
    try {
      await fetch(`/api/chat/mark-read/${chatRoom.id}`, { method: 'POST' })
      await fetch(`/api/notifications/delete-chat/${chatRoom.id}`, { method: 'DELETE' })
      
      setChatTabs(prev => prev.map(tab =>
        tab.applicationId === applicationId
          ? { ...tab, unreadCount: 0 }
          : tab
      ))
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }

    subscribeToRoom(chatRoom.id)

    // Close sidebar on mobile after selecting chat
    setIsSidebarOpen(false)
  }, [currentUser, chatRooms, messages, loadMessagesForRoom, subscribeToRoom])

  // Handle open chat events from other components
  useEffect(() => {
    const handleOpenChat = (event: CustomEvent) => {
      const { applicationId } = event.detail
      setIsPanelOpen(true)
      if (applicationId && currentUser) {
        openChat(applicationId)
      }
    }

    window.addEventListener('openChat' as any, handleOpenChat)
    return () => window.removeEventListener('openChat' as any, handleOpenChat)
  }, [currentUser, openChat])

  // Group conversations
  const groupedConversations = useMemo(() => {
    if (activeTab === 'properties') {
      const propertyGroups = new Map<string, GroupedConversation>()

      chatTabs
        .filter(tab => tab.role === 'owner')
        .forEach(tab => {
          const propertyId = tab.propertyId || tab.applicationId
          if (!propertyGroups.has(propertyId)) {
            propertyGroups.set(propertyId, {
              id: propertyId,
              title: tab.propertyName,
              type: 'property',
              conversations: [],
              totalUnread: 0,
              lastActivity: tab.lastMessageTime || '1970-01-01'
            })
          }

          const group = propertyGroups.get(propertyId)!
          group.conversations.push(tab)
          group.totalUnread += tab.unreadCount

          if (tab.lastMessageTime && tab.lastMessageTime > group.lastActivity) {
            group.lastActivity = tab.lastMessageTime
          }
        })

      return Array.from(propertyGroups.values())
        .sort((a, b) => {
          if (a.totalUnread !== b.totalUnread) {
            return b.totalUnread - a.totalUnread
          }
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
        })
    } else {
      const applicationGroups = new Map<string, GroupedConversation>()

      chatTabs
        .filter(tab => tab.role === 'applicant' && tab.applicationStatus === 'accepted')
        .forEach(tab => {
          const groupId = tab.applicationId
          if (!applicationGroups.has(groupId)) {
            applicationGroups.set(groupId, {
              id: groupId,
              title: tab.propertyName,
              type: 'application',
              conversations: [tab],
              totalUnread: tab.unreadCount,
              lastActivity: tab.lastMessageTime || '1970-01-01',
              status: tab.applicationStatus
            })
          }
        })

      return Array.from(applicationGroups.values())
        .sort((a, b) => {
          if (a.totalUnread !== b.totalUnread) {
            return b.totalUnread - a.totalUnread
          }
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
        })
    }
  }, [chatTabs, activeTab])

  // Filter conversations based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groupedConversations

    return groupedConversations.filter(group =>
      group.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.conversations.some(tab =>
        tab.otherPartyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tab.applicationStatus.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
  }, [groupedConversations, searchQuery])

  // Cleanup subscriptions
  useEffect(() => {
    return () => {
      Object.values(roomChannelsRef.current).forEach(channel => {
        try { supabase.removeChannel(channel) } catch { }
      })
      roomChannelsRef.current = {}
    }
  }, [supabase])

  // Don't render if user is not authenticated
  if (!currentUser) return null

  const selectedTab = selectedApplicationId
    ? chatTabs.find(t => t.applicationId === selectedApplicationId)
    : null

  const selectedChatRoom = selectedApplicationId ? chatRooms[selectedApplicationId] : null
  const selectedMessages = selectedChatRoom ? messages[selectedChatRoom.id] || [] : []

  return (
    <>
      {/* Desktop Chat Panel */}
      <div className="hidden md:block fixed bottom-4 right-4 z-50">
        {isPanelOpen && (
          <Card className="w-[900px] h-[600px] max-h-[80vh] flex flex-col shadow-xl">
            <CardHeader className="p-3 pb-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium truncate">
                  {selectedTab?.title || 'Chats'}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setIsPanelOpen(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 min-h-0 flex">
              {/* Desktop Sidebar */}
              <div className="w-80 border-r bg-gray-50 h-full flex flex-col">
                <ConversationSidebar
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  filteredGroups={filteredGroups}
                  groupedConversations={groupedConversations}
                  selectedApplicationId={selectedApplicationId}
                  openChat={openChat}
                />
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col">
                <ChatArea
                  selectedTab={selectedTab}
                  selectedMessages={selectedMessages}
                  newMessage={newMessages[selectedApplicationId || ''] || ''}
                  setNewMessage={(value) => setNewMessages(prev => ({
                    ...prev,
                    [selectedApplicationId || '']: value
                  }))}
                  sendMessage={() => selectedApplicationId && sendMessage(selectedApplicationId)}
                  sending={sending}
                  messageEndRef={messageEndRef}
                  currentUser={currentUser}
                  isMobile={false}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mobile Chat Panel */}
      {isPanelOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 bottom-0 z-40 bg-white flex flex-col">
          {/* Mobile Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b p-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(true)}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-medium truncate">
                  {selectedTab?.title || 'Select a chat'}
                </h1>
                {selectedTab && (
                  <p className="text-xs text-gray-600 truncate">
                    {selectedTab.otherPartyName}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0"
              onClick={() => setIsPanelOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile Chat Area */}
          <div className="flex-1 flex flex-col min-h-0 pb-safe">
            <ChatArea
              selectedTab={selectedTab}
              selectedMessages={selectedMessages}
              newMessage={newMessages[selectedApplicationId || ''] || ''}
              setNewMessage={(value) => setNewMessages(prev => ({
                ...prev,
                [selectedApplicationId || '']: value
              }))}
              sendMessage={() => selectedApplicationId && sendMessage(selectedApplicationId)}
              sending={sending}
              messageEndRef={messageEndRef}
              currentUser={currentUser}
              isMobile={true}
            />
          </div>

          {/* Mobile Sidebar Sheet */}
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetContent side="left" className="w-full sm:w-80 p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle>Conversations</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-hidden">
                <ConversationSidebar
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  filteredGroups={filteredGroups}
                  groupedConversations={groupedConversations}
                  selectedApplicationId={selectedApplicationId}
                  openChat={openChat}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </>
  )
}

// Conversation Sidebar Component
interface ConversationSidebarProps {
  activeTab: 'properties' | 'applications'
  setActiveTab: (tab: 'properties' | 'applications') => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  filteredGroups: GroupedConversation[]
  groupedConversations: GroupedConversation[]
  selectedApplicationId: string | null
  openChat: (applicationId: string) => void
}

function ConversationSidebar({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  filteredGroups,
  groupedConversations,
  selectedApplicationId,
  openChat
}: ConversationSidebarProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b bg-white">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Conversations</h3>
          <p className="text-xs text-gray-500">
            {searchQuery ? `${filteredGroups.length} of ${groupedConversations.length}` : `${groupedConversations.length} total`}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'properties' | 'applications')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="properties" className="text-xs flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              My Listings
            </TabsTrigger>
            <TabsTrigger value="applications" className="text-xs flex items-center gap-1">
              <Home className="h-3 w-3" />
              My Applications
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative mt-2">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-600">No conversations found</p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.id} className="space-y-1">
                <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                  <div className="flex items-center justify-between">
                    <span className="truncate">{group.title}</span>
                    {group.totalUnread > 0 && (
                      <Badge variant="destructive" className="h-4 text-xs px-1">
                        {group.totalUnread}
                      </Badge>
                    )}
                  </div>
                </div>
                {group.conversations.map((tab) => (
                  <Button
                    key={tab.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start h-auto p-2 text-left",
                      selectedApplicationId === tab.applicationId && "bg-blue-100 hover:bg-blue-100"
                    )}
                    onClick={() => openChat(tab.applicationId)}
                  >
                    <div className="flex items-center gap-2 w-full min-w-0">
                      <Avatar className="h-6 w-6 flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {tab.otherPartyName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {tab.otherPartyName}
                        </p>
                        {tab.lastMessage && (
                          <p className="text-xs text-gray-500 truncate">
                            {tab.lastMessage}
                          </p>
                        )}
                      </div>
                      {tab.unreadCount > 0 && (
                        <Badge variant="destructive" className="h-4 text-xs px-1 flex-shrink-0">
                          {tab.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// Chat Area Component
interface ChatAreaProps {
  selectedTab: ChatTab | null
  selectedMessages: Message[]
  newMessage: string
  setNewMessage: (value: string) => void
  sendMessage: () => void
  sending: boolean
  messageEndRef: React.RefObject<HTMLDivElement>
  currentUser: string | null
  isMobile?: boolean
}

function ChatArea({
  selectedTab,
  selectedMessages,
  newMessage,
  setNewMessage,
  sendMessage,
  sending,
  messageEndRef,
  currentUser,
  isMobile = false
}: ChatAreaProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!selectedTab) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Select a conversation to start chatting</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ScrollArea className={`flex-1 ${isMobile ? 'p-3' : 'p-4'}`}>
        <div className="space-y-4">
          {selectedMessages.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No messages yet</p>
              <p className="text-sm text-gray-500">Start the conversation!</p>
            </div>
          ) : (
            selectedMessages.map((message) => (
              <MessageBubble key={message.id} message={message} currentUser={currentUser} />
            ))
          )}
          <div ref={messageEndRef} />
          {/* Extra padding for mobile to ensure last message is visible */}
          {isMobile && <div className="h-4" />}
        </div>
      </ScrollArea>

      <div className={`border-t bg-white ${isMobile ? 'p-3 pb-4' : 'p-4'} flex-shrink-0`}>
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={sending}
            className={`flex-1 ${isMobile ? 'h-10' : ''}`}
          />
          <Button 
            onClick={sendMessage} 
            disabled={!newMessage.trim() || sending}
            size="sm"
            className={isMobile ? 'h-10 px-3' : ''}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  )
}

// Message Bubble Component
interface MessageBubbleProps {
  message: Message
  currentUser: string | null
}

function MessageBubble({ message, currentUser }: MessageBubbleProps) {
  const [senderProfile, setSenderProfile] = useState<any>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const getSenderProfile = async () => {
      const { data: profile } = await supabase
        .from('users')
        .select('full_name, avatar_url')
        .eq('id', message.sender_id)
        .single()
      setSenderProfile(profile)
    }
    getSenderProfile()
  }, [message.sender_id, supabase])

  const isOwnMessage = currentUser === message.sender_id
  const senderName = senderProfile?.full_name || message.sender?.full_name || `User ${message.sender_id.slice(0, 8)}`
  const avatarUrl = senderProfile?.avatar_url || message.sender?.avatar_url

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} w-full`}>
      <div className={`flex gap-2 w-full max-w-[400px] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={avatarUrl || undefined} alt={senderName} />
          <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
            {senderName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        
        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          <div className={`rounded-lg px-3 py-2 w-full max-w-[320px] break-words whitespace-pre-wrap ${
            isOwnMessage 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-900'
          }`}>
            <p className="text-sm">{message.content}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">
              {format(new Date(message.created_at), 'HH:mm')}
            </span>
            {message.read_at && (
              <span className="text-xs text-blue-600">✓ Read</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}