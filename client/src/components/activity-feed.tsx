import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Clock, TrendingUp } from "lucide-react";
import { getInitials } from "@/lib/map-utils";

interface ActivityItem {
  id: string;
  type: 'pin_added' | 'map_created' | 'collaboration';
  userName: string;
  mapName: string;
  location?: string;
  timestamp: string;
  pinCount?: number;
}

const mockActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'pin_added',
    userName: 'Sarah Chen',
    mapName: 'Local Coffee Shops',
    location: 'Blue Bottle Coffee, Oakland',
    timestamp: '2 minutes ago',
  },
  {
    id: '2',
    type: 'map_created',
    userName: 'Mike Johnson',
    mapName: 'Best Food Trucks in Austin',
    timestamp: '5 minutes ago',
    pinCount: 0,
  },
  {
    id: '3',
    type: 'pin_added',
    userName: 'Emma Rodriguez',
    mapName: 'Art Galleries Downtown',
    location: 'MOMA, New York',
    timestamp: '8 minutes ago',
  },
  {
    id: '4',
    type: 'collaboration',
    userName: 'Alex Kim',
    mapName: 'Team Lunch Spots',
    timestamp: '12 minutes ago',
    pinCount: 7,
  },
  {
    id: '5',
    type: 'pin_added',
    userName: 'Jessica Park',
    mapName: 'Weekend Hiking Trails',
    location: 'Golden Gate Park, San Francisco',
    timestamp: '15 minutes ago',
  },
  {
    id: '6',
    type: 'map_created',
    userName: 'David Wilson',
    mapName: 'Historic Landmarks Tour',
    timestamp: '18 minutes ago',
    pinCount: 0,
  },
  {
    id: '7',
    type: 'pin_added',
    userName: 'Lisa Zhang',
    mapName: 'Pet-Friendly Restaurants',
    location: 'The Dog House, Portland',
    timestamp: '22 minutes ago',
  },
  {
    id: '8',
    type: 'collaboration',
    userName: 'Tom Anderson',
    mapName: 'Conference Networking Events',
    timestamp: '25 minutes ago',
    pinCount: 12,
  },
];

export function ActivityFeed() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleActivities, setVisibleActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Show 4 activities at a time
    const startIndex = currentIndex;
    const endIndex = startIndex + 4;
    setVisibleActivities(mockActivities.slice(startIndex, endIndex));
  }, [currentIndex]);

  useEffect(() => {
    // Auto-rotate every 5 seconds
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        // Reset to beginning if we've shown all activities
        return nextIndex >= mockActivities.length - 3 ? 0 : nextIndex;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'pin_added':
        return <MapPin className="h-4 w-4 text-blue-600" />;
      case 'map_created':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'collaboration':
        return <Users className="h-4 w-4 text-purple-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityText = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'pin_added':
        return (
          <span>
            <span className="font-medium">{activity.userName}</span> pinned{' '}
            <span className="font-medium text-blue-600">{activity.location}</span>{' '}
            to <span className="font-medium">{activity.mapName}</span>
          </span>
        );
      case 'map_created':
        return (
          <span>
            <span className="font-medium">{activity.userName}</span> created{' '}
            <span className="font-medium text-green-600">{activity.mapName}</span>
          </span>
        );
      case 'collaboration':
        return (
          <span>
            <span className="font-medium">{activity.userName}</span> added {activity.pinCount} pins to{' '}
            <span className="font-medium">{activity.mapName}</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getBadgeColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'pin_added':
        return 'bg-blue-100 text-blue-800';
      case 'map_created':
        return 'bg-green-100 text-green-800';
      case 'collaboration':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Community Activity
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Live Feed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleActivities.map((activity, index) => (
          <div
            key={`${activity.id}-${currentIndex}`}
            className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-500 ${
              index === 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
            }`}
            style={{
              animationDelay: `${index * 0.1}s`,
            }}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {getInitials(activity.userName)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getActivityIcon(activity.type)}
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${getBadgeColor(activity.type)} border-0`}
                  >
                    {activity.type.replace('_', ' ')}
                  </Badge>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {activity.timestamp}
                </span>
              </div>
              
              <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                {getActivityText(activity)}
              </p>
            </div>
          </div>
        ))}
        
        {/* Progress indicator */}
        <div className="flex justify-center pt-2">
          <div className="flex gap-1">
            {Array.from({ length: Math.ceil(mockActivities.length / 4) }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  Math.floor(currentIndex / 4) === i ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}