import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { generateShareImage } from "@/lib/share-image";
import { downloadBlob, openLinkIntent, shareImageNatively } from "@/lib/share-actions";
import { Check, Copy, Facebook, Instagram, Loader2, Mail, Share2, Twitter } from "lucide-react";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.886 3.488" />
    </svg>
  );
}

interface SharePopoverProps {
  mapId: string;
  shareUrl: string;
  mapName: string;
  ownerName?: string | null;
  pinCount: number;
  isOwner: boolean;
  onInvite: () => void;
}

/**
 * The prominent, always-visible "Share" entry point on the map-detail page —
 * a single button opening a compact popover with copy-link, image-backed
 * social sharing, and (owner-only) a shortcut into the invite dialog.
 */
export function SharePopover({ mapId, shareUrl, mapName, ownerName, pinCount, isOwner, onInvite }: SharePopoverProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingPlatform, setPendingPlatform] = useState<string | null>(null);

  const fullShareUrl = `${window.location.origin}/map/${shareUrl}`;
  const caption = `Check out "${mapName}" on PinTogather — ${fullShareUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      setCopied(true);
      toast({ title: "Link copied", variant: "success" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" });
    }
  };

  const shareWithImage = async (platform: "instagram" | "twitter" | "whatsapp") => {
    setPendingPlatform(platform);
    try {
      const blob = await generateShareImage({ mapId, mapName, ownerName, pinCount });
      const file = new File([blob], "pintogather-map.png", { type: "image/png" });

      const sharedNatively = await shareImageNatively(file, mapName, caption);
      if (sharedNatively) return;

      if (platform === "instagram") {
        // Instagram has no web share-intent URL at all — downloading the
        // image and copying a caption is the only fallback when the native
        // share sheet isn't available (e.g. on desktop).
        downloadBlob(blob, "pintogather-map.png");
        await navigator.clipboard.writeText(caption).catch(() => {});
        toast({
          title: "Image saved, caption copied",
          description: "Instagram doesn't support sharing directly from the web — open Instagram and post the image with the copied caption.",
        });
      } else {
        // X/WhatsApp web intents accept text+link but not an attached
        // image, so open the intent for the message and also hand over the
        // image separately.
        openLinkIntent(platform, fullShareUrl, caption);
        downloadBlob(blob, "pintogather-map.png");
        toast({
          title: "Image downloaded",
          description: `${platform === "twitter" ? "X" : "WhatsApp"}'s share link doesn't accept attachments — attach the downloaded image to your post manually for the full effect.`,
        });
      }
    } catch (error) {
      toast({ title: "Couldn't create share image", variant: "destructive" });
    } finally {
      setPendingPlatform(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="default" size="sm" data-testid="button-share">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={copyLink}
          data-testid="button-share-copy-link"
        >
          {copied ? <Check className="h-4 w-4 mr-2 text-emerald-600" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? "Link copied" : "Copy link"}
        </Button>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Share with an image</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="flex-1 text-[#E1306C] hover:text-[#E1306C]"
              onClick={() => shareWithImage("instagram")}
              disabled={pendingPlatform !== null}
              title="Share to Instagram"
              data-testid="button-share-instagram"
            >
              {pendingPlatform === "instagram" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="flex-1"
              onClick={() => shareWithImage("twitter")}
              disabled={pendingPlatform !== null}
              title="Share to X"
              data-testid="button-share-twitter"
            >
              {pendingPlatform === "twitter" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Twitter className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="flex-1 text-[#25D366] hover:text-[#25D366]"
              onClick={() => shareWithImage("whatsapp")}
              disabled={pendingPlatform !== null}
              title="Share to WhatsApp"
              data-testid="button-share-whatsapp"
            >
              {pendingPlatform === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin" /> : <WhatsAppIcon className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="flex-1 text-[#1877F2] hover:text-[#1877F2]"
              onClick={() => openLinkIntent("facebook", fullShareUrl, caption)}
              title="Share to Facebook"
              data-testid="button-share-facebook"
            >
              <Facebook className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground/80 leading-snug">
            Generates a card with the map's title and owner — on mobile this opens your share sheet so you can post directly; on desktop the image downloads for you to attach.
          </p>
        </div>

        {isOwner && (
          <>
            <Separator />
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                onInvite();
              }}
              data-testid="button-share-invite"
            >
              <Mail className="h-4 w-4 mr-2" />
              Invite by email
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
