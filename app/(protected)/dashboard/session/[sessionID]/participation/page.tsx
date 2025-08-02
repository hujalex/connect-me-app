"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Users,
  Calendar,
  Download,
  UserCheck,
  UserX,
} from "lucide-react";

interface ParticipantEvent {
  id: string;
  participantId: string;
  name: string;
  email: string;
  avatar?: string;
  action: "joined" | "left";
  timestamp: Date;
}

interface ParticipantSummary {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  totalDuration: number; // in minutes
  joinCount: number;
  currentlyInMeeting: boolean;
  firstJoined: Date;
  lastActivity: Date;
}

export default function MeetingParticipation() {
  const [meetingData] = useState({
    meetingId: "zoom-meeting-123",
    meetingTitle: "Aaron & Alex Tutoring Session",
    startTime: new Date("2024-01-15T10:00:00"),
    endTime: new Date("2024-01-15T11:30:00"),
    totalDuration: 90, // minutes
  });

  const [events] = useState<ParticipantEvent[]>([
    {
      id: "1",
      participantId: "user1",
      name: "Sarah Johnson",
      email: "sarah@company.com",
      avatar: "/placeholder.svg?height=40&width=40",
      action: "joined",
      timestamp: new Date("2024-01-15T10:00:00"),
    },
    {
      id: "2",
      participantId: "user2",
      name: "Mike Chen",
      email: "mike@company.com",
      avatar: "/placeholder.svg?height=40&width=40",
      action: "joined",
      timestamp: new Date("2024-01-15T10:02:00"),
    },
    {
      id: "3",
      participantId: "user3",
      name: "Emily Rodriguez",
      email: "emily@company.com",
      avatar: "/placeholder.svg?height=40&width=40",
      action: "joined",
      timestamp: new Date("2024-01-15T10:05:00"),
    },
    {
      id: "4",
      participantId: "user2",
      name: "Mike Chen",
      email: "mike@company.com",
      avatar: "/placeholder.svg?height=40&width=40",
      action: "left",
      timestamp: new Date("2024-01-15T10:45:00"),
    },
    {
      id: "5",
      participantId: "user4",
      name: "David Kim",
      email: "david@company.com",
      avatar: "/placeholder.svg?height=40&width=40",
      action: "joined",
      timestamp: new Date("2024-01-15T10:15:00"),
    },
    {
      id: "6",
      participantId: "user2",
      name: "Mike Chen",
      email: "mike@company.com",
      avatar: "/placeholder.svg?height=40&width=40",
      action: "joined",
      timestamp: new Date("2024-01-15T11:00:00"),
    },
    {
      id: "7",
      participantId: "user3",
      name: "Emily Rodriguez",
      email: "emily@company.com",
      avatar: "/placeholder.svg?height=40&width=40",
      action: "left",
      timestamp: new Date("2024-01-15T11:25:00"),
    },
  ]);

  // Calculate participant summaries
  const participantSummaries: ParticipantSummary[] = (() => {
    const summaries = new Map<string, ParticipantSummary>();

    events.forEach((event) => {
      if (!summaries.has(event.participantId)) {
        summaries.set(event.participantId, {
          id: event.participantId,
          name: event.name,
          email: event.email,
          avatar: event.avatar,
          totalDuration: 0,
          joinCount: 0,
          currentlyInMeeting: false,
          firstJoined: event.timestamp,
          lastActivity: event.timestamp,
        });
      }

      const summary = summaries.get(event.participantId)!;
      summary.lastActivity = event.timestamp;

      if (event.action === "joined") {
        summary.joinCount++;
        summary.currentlyInMeeting = true;
      } else {
        summary.currentlyInMeeting = false;
      }
    });

    // Calculate durations
    summaries.forEach((summary) => {
      const userEvents = events.filter((e) => e.participantId === summary.id);
      let totalDuration = 0;
      let joinTime: Date | null = null;

      userEvents.forEach((event) => {
        if (event.action === "joined") {
          joinTime = event.timestamp;
        } else if (event.action === "left" && joinTime) {
          totalDuration +=
            (event.timestamp.getTime() - joinTime.getTime()) / (1000 * 60);
          joinTime = null;
        }
      });

      // If still in meeting, calculate duration until meeting end
      if (joinTime && summary.currentlyInMeeting) {
        totalDuration +=
          (meetingData.endTime.getTime() - joinTime.getTime()) / (1000 * 60);
      }

      summary.totalDuration = Math.round(totalDuration);
    });

    return Array.from(summaries.values()).sort(
      (a, b) => b.totalDuration - a.totalDuration
    );
  })();

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Meeting Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{meetingData.meetingTitle}</h1>
          <p className="text-muted-foreground mt-1">
            Meeting ID: {meetingData.meetingId}
          </p>
        </div>
        <Button variant="outline" className="gap-2 bg-transparent">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Meeting Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Duration</div>
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatDuration(meetingData.totalDuration)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                Total Participants
              </div>
            </div>
            <div className="text-2xl font-bold mt-1">
              {participantSummaries.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                Currently Active
              </div>
            </div>
            <div className="text-2xl font-bold mt-1">
              {participantSummaries.filter((p) => p.currentlyInMeeting).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Avg. Duration</div>
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatDuration(
                Math.round(
                  participantSummaries.reduce(
                    (acc, p) => acc + p.totalDuration,
                    0
                  ) / participantSummaries.length
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Participant Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Participant Summary</CardTitle>
            <CardDescription>
              Total time spent by each participant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {participantSummaries.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage
                      src={participant.avatar || "/placeholder.svg"}
                      alt={participant.name}
                    />
                    <AvatarFallback>
                      {participant.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{participant.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {participant.email}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        participant.currentlyInMeeting ? "default" : "secondary"
                      }
                    >
                      {participant.currentlyInMeeting ? "Active" : "Left"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatDuration(participant.totalDuration)} •{" "}
                    {participant.joinCount} joins
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>
              Complete history of joins and leaves
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {events.map((event, index) => (
                <div key={event.id}>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${event.action === "joined" ? "bg-green-500" : "bg-red-500"}`}
                    />
                    <Avatar className="w-8 h-8">
                      <AvatarImage
                        src={event.avatar || "/placeholder.svg"}
                        alt={event.name}
                      />
                      <AvatarFallback className="text-xs">
                        {event.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{event.name}</span>
                        <Badge
                          variant={
                            event.action === "joined"
                              ? "default"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {event.action === "joined" ? (
                            <>
                              <UserCheck className="w-3 h-3 mr-1" /> Joined
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3 mr-1" /> Left
                            </>
                          )}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatTime(event.timestamp)}
                      </div>
                    </div>
                  </div>
                  {index < events.length - 1 && (
                    <Separator className="ml-6 mt-3" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
