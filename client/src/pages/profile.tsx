import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { User, Save, ArrowLeft, ExternalLink, Check, X, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { USERNAME_PATTERN } from "@shared/schema";

interface ProfileData {
  full_name: string;
  username: string;
  bio: string;
  twitter_handle: string;
  instagram_handle: string;
  linkedin_handle: string;
}

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const BIO_MAX_LENGTH = 160;

export default function Profile() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: "",
    username: "",
    bio: "",
    twitter_handle: "",
    instagram_handle: "",
    linkedin_handle: "",
  });
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");

  useEffect(() => {
    if (!user) return;
    const fullName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ");
    setProfileData({
      full_name: fullName,
      username: user.username || "",
      bio: user.bio || "",
      twitter_handle: user.twitterHandle || "",
      instagram_handle: user.instagramHandle || "",
      linkedin_handle: user.linkedinHandle || "",
    });
  }, [user]);

  // Live-check username availability as the user types, debounced.
  useEffect(() => {
    const candidate = profileData.username.trim().toLowerCase();
    if (!candidate || candidate === (user?.username || "")) {
      setUsernameStatus("idle");
      return;
    }
    if (!USERNAME_PATTERN.test(candidate)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    const timeout = setTimeout(async () => {
      try {
        const response = await apiRequest("GET", `/api/users/${encodeURIComponent(candidate)}/availability`);
        const data = await response.json();
        setUsernameStatus(data.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [profileData.username, user?.username]);

  const saveProfileMutation = useMutation({
    mutationFn: async (data: ProfileData) => {
      const username = data.username.trim().toLowerCase();
      const response = await apiRequest("PUT", "/api/profile", {
        fullName: data.full_name,
        username: username || null,
        bio: data.bio.trim() || null,
        twitterHandle: data.twitter_handle || null,
        instagramHandle: data.instagram_handle || null,
        linkedinHandle: data.linkedin_handle || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: `Unable to save profile: ${error.message || "Unknown error occurred"}`,
        variant: "destructive",
      });
    },
  });

  const loading = saveProfileMutation.isPending;
  const canSubmitUsername = usernameStatus !== "taken" && usernameStatus !== "invalid" && usernameStatus !== "checking";

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!canSubmitUsername) return;
    saveProfileMutation.mutate(profileData);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
            <p className="text-gray-600 mb-4">Please sign in to access your profile.</p>
            <Link href="/">
              <Button className="w-full">Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const previewUrl = `${window.location.origin}/u/${profileData.username.trim().toLowerCase() || "your-username"}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <User className="h-6 w-6 mr-3 text-gray-600" />
            <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
          </div>

          {user.email && (
            <p className="text-sm text-gray-600">
              Logged in as: <span className="font-medium">{user.email}</span>
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  type="text"
                  placeholder="Enter your full name"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  className="h-12 text-base"
                  data-testid="input-fullname"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">@</span>
                  <Input
                    id="username"
                    type="text"
                    placeholder="your-username"
                    value={profileData.username}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    className="pl-8 pr-10 h-12 text-base"
                    maxLength={30}
                    data-testid="input-username"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                    {usernameStatus === "available" && <Check className="h-4 w-4 text-emerald-600" />}
                    {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
                {usernameStatus === "taken" && (
                  <p className="text-xs text-destructive">That username is already taken.</p>
                )}
                {usernameStatus === "invalid" && (
                  <p className="text-xs text-destructive">
                    3-30 characters: lowercase letters, numbers, or underscores, starting with a letter.
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Claim a username to get a public profile page listing your public maps:{" "}
                  <span className="font-medium text-gray-700">{previewUrl}</span>
                </p>
                {user.username && (
                  <Link href={`/u/${user.username}`}>
                    <Button type="button" variant="outline" size="sm" data-testid="link-view-public-profile">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      View public profile
                    </Button>
                  </Link>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bio">Bio</Label>
                  <span className="text-xs text-gray-500">
                    {profileData.bio.length}/{BIO_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="bio"
                  placeholder="A short bio shown on your public profile"
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value.slice(0, BIO_MAX_LENGTH) })}
                  rows={3}
                  data-testid="input-bio"
                />
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">Social Media Handles (Optional)</Label>

                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-500">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                      </svg>
                    </div>
                    <Input
                      placeholder="Twitter handle or profile URL"
                      value={profileData.twitter_handle}
                      onChange={(e) => setProfileData({ ...profileData, twitter_handle: e.target.value })}
                      className="pl-12 h-12 text-base"
                      data-testid="input-twitter"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pink-500">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.621 5.367 11.988 11.988 11.988s11.987-5.367 11.987-11.988C24.004 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.321-1.295C3.897 14.475 3.365 13.48 3.365 12.017s.532-2.458 1.763-3.676C6.001 7.536 7.152 7.046 8.449 7.046s2.448.49 3.321 1.295c1.231 1.218 1.763 2.213 1.763 3.676s-.532 2.458-1.763 3.676c-.873.805-2.024 1.295-3.321 1.295z"/>
                      </svg>
                    </div>
                    <Input
                      placeholder="Instagram handle or profile URL"
                      value={profileData.instagram_handle}
                      onChange={(e) => setProfileData({ ...profileData, instagram_handle: e.target.value })}
                      className="pl-12 h-12 text-base"
                      data-testid="input-instagram"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </div>
                    <Input
                      placeholder="LinkedIn profile URL or handle"
                      value={profileData.linkedin_handle}
                      onChange={(e) => setProfileData({ ...profileData, linkedin_handle: e.target.value })}
                      className="pl-12 h-12 text-base"
                      data-testid="input-linkedin"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  type="submit"
                  className="w-full h-12 text-base"
                  disabled={loading || !canSubmitUsername}
                  data-testid="button-save-profile"
                >
                  <Save className="h-5 w-5 mr-2" />
                  {loading ? "Saving..." : "Save Profile"}
                </Button>

                <Link href="/">
                  <Button type="button" variant="outline" className="w-full h-12 text-base">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Home
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
