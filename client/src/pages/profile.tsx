import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabase } from "@/lib/supabase";
import { User, Save, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface ProfileData {
  full_name: string;
  twitter_handle: string;
  instagram_handle: string;
  linkedin_handle: string;
}

export default function Profile() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: "",
    twitter_handle: "",
    instagram_handle: "",
    linkedin_handle: "",
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Try to load from localStorage first as fallback
      const localProfile = localStorage.getItem(`profile_${user.id}`);
      if (localProfile) {
        const parsedProfile = JSON.parse(localProfile);
        setProfileData({
          full_name: parsedProfile.full_name || "",
          twitter_handle: parsedProfile.twitter_handle || "",
          instagram_handle: parsedProfile.instagram_handle || "",
          linkedin_handle: parsedProfile.linkedin_handle || "",
        });
      }

      // Try Supabase if available
      const supabase = getSupabase();
      if (supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', error);
        } else if (data) {
          setProfileData({
            full_name: data.full_name || "",
            twitter_handle: data.twitter_handle || "",
            instagram_handle: data.instagram_handle || "",
            linkedin_handle: data.linkedin_handle || "",
          });
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Save to localStorage as primary storage
      const profileToSave = {
        user_id: user.id,
        full_name: profileData.full_name,
        twitter_handle: profileData.twitter_handle || null,
        instagram_handle: profileData.instagram_handle || null,
        linkedin_handle: profileData.linkedin_handle || null,
        updated_at: new Date().toISOString(),
      };

      localStorage.setItem(`profile_${user.id}`, JSON.stringify(profileToSave));

      // Try to save to Supabase if available
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { error } = await supabase
            .from('profiles')
            .upsert(profileToSave);

          if (error && error.code === '42P01') {
            console.log('Profiles table not found, using local storage');
          } else if (error) {
            console.error('Supabase error:', error);
            toast({
              title: "Profile Saved Locally",
              description: `Profile saved but cloud sync failed: ${error.message}. Your data is stored locally.`,
              variant: "default",
            });
          }
        } catch (supabaseError: any) {
          console.error('Supabase connection error:', supabaseError);
          toast({
            title: "Profile Saved Locally",
            description: "Profile saved locally. Cloud sync unavailable at the moment.",
            variant: "default",
          });
        }
      }

      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: `Unable to save profile: ${error.message || 'Unknown error occurred'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="mb-6">
          <div className="flex justify-end mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="px-2 py-1 h-8 text-sm touch-target">
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back
              </Button>
            </Link>
          </div>
          
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
                  required
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
                      placeholder="Twitter handle (without @)"
                      value={profileData.twitter_handle}
                      onChange={(e) => setProfileData({ ...profileData, twitter_handle: e.target.value })}
                      className="pl-12 h-12 text-base"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pink-500">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.621 5.367 11.988 11.988 11.988s11.987-5.367 11.987-11.988C24.004 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.49-3.321-1.295C3.897 14.475 3.365 13.48 3.365 12.017s.532-2.458 1.763-3.676C6.001 7.536 7.152 7.046 8.449 7.046s2.448.49 3.321 1.295c1.231 1.218 1.763 2.213 1.763 3.676s-.532 2.458-1.763 3.676c-.873.805-2.024 1.295-3.321 1.295z"/>
                      </svg>
                    </div>
                    <Input
                      placeholder="Instagram handle (without @)"
                      value={profileData.instagram_handle}
                      onChange={(e) => setProfileData({ ...profileData, instagram_handle: e.target.value })}
                      className="pl-12 h-12 text-base"
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
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  type="submit"
                  className="w-full h-12 text-base"
                  disabled={loading}
                >
                  <Save className="h-5 w-5 mr-2" />
                  {loading ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}