"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Filter, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProfilePairingMetadata } from "@/types/profile";
import { PairingRequestCard } from "./que/request-card";
import { PairingLogsTable } from "./pairing-logs";
import { useProfile } from "@/hooks/auth";
import { TestingPairingControls } from "./test-controls";
import {
  getIncomingPairingMatches,
  IncomingPairingMatch,
} from "@/lib/actions/pairing.actions";
import { updatePairingMatchStatus } from "@/lib/actions/pairing.actions";
// import { updatePairingMatchStatus } from "@/lib/actions/pairing.server.actions";

import toast from "react-hot-toast";

export function PairingInterface() {
  const [activeTab, setActiveTab] = useState("find");
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | undefined>();
  const [requestedPairings, setRequestedPairings] = useState<string[]>([]);

  const { profile } = useProfile();

  const [matchedPairings, setMatchedPairings] = useState<
    IncomingPairingMatch[]
  >([]);

  useEffect(() => {
    if (!profile) return;
    getIncomingPairingMatches(profile.id).then((result) => {
      if (result) setMatchedPairings(result);

      console.log("matches: ", result);
    });
  }, [profile]);

  //handle mutating match state
  const handleAcceptPairingMatch = (
    matchId: string,
    status: "accepted" | "rejected"
  ) => {
    const promise = updatePairingMatchStatus(profile.id, matchId, status);

    toast.promise(promise, {
      loading: `${status === "accepted" ? "Accepting" : "Rejecting"} pairing...`,
      success: `Successfully ${status} pairing`,
      error: (err) =>
        `Failed to ${status.slice(0, -2)} pairing: ${err.message}`,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Tabs
          defaultValue="find"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="find">Incoming Pairings</TabsTrigger>
            <TabsTrigger value="requests">Requested Pairings</TabsTrigger>
          </TabsList>

          <TabsContent value="find" className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or subject..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* <Select
              value={subjectFilter ?? ""}
              onValueChange={setSubjectFilter}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="Filter by subject" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={""}>All Subjects</SelectItem>
                {allSubjects.map((subject) => (
                  <SelectItem key={subject} value={subject! ?? ""}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select> */}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {matchedPairings.length > 0 ? (
                matchedPairings.map((match) => {
                  const roleFilter =
                    profile.role === "Student" ? "tutor" : "student";
                  const matchedProfile = match[roleFilter];
                  return (
                    <Card key={match.pairing_match_id}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{`${matchedProfile.first_name} ${matchedProfile.last_name}`}</CardTitle>
                            <CardDescription className="flex items-center gap-1">
                              <UserRound className="h-3 w-3" />
                              {matchedProfile.role}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Subjects
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {matchedProfile.subjectsOfInterest?.map(
                                (subject, i) => (
                                  <Badge key={i} variant="secondary">
                                    {subject}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Languages
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {matchedProfile.languagesSpoken?.map(
                                (language, i) => (
                                  <Badge key={i} variant="outline">
                                    {language}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter>
                        {profile.role === "Tutor" && (
                          <div className="space-x-4 flex">
                            <Button
                              className="w-full bg-green-500"
                              // disabled={requestedPairings.includes(matchedProfile.matchedProfileId)}
                              onClick={() =>
                                handleAcceptPairingMatch(
                                  match.pairing_match_id,
                                  "accepted"
                                )
                              }
                            >
                              Accept
                            </Button>
                            <Button
                              className="w-full bg-red-500"
                              // disabled={requestedPairings.includes(matchedProfile.matchedProfileId)}
                              onClick={() =>
                                handleAcceptPairingMatch(
                                  match.pairing_match_id,
                                  "rejected"
                                )
                              }
                            >
                              Decline
                            </Button>
                          </div>
                        )}
                        {profile.role === "Student" && (
                          <Button className="w-full gap-2 p-4">
                            <Clock />
                            Waiting
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-2 text-center py-8">
                  <p className="text-muted-foreground">
                    No matching profiles found
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="requests">
            {profile && <PairingRequestCard userId={profile.userId} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
