import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
const logoImage = "/images/logo.png";
import {
  ArrowLeft,
  Speaker,
  Drum,
  Guitar,
  Music,
  Phone,
  MessageCircle,
} from "lucide-react";

const ADMIN_WA = "628991601137";

const alatMusikItems = [
  {
    name: "Drum Set Lengkap",
    desc: "Pearl / Tama + cymbal set",
    icon: Drum,
    available: true,
  },
  {
    name: "Gitar Elektrik",
    desc: "Fender / Ibanez + kabel jack",
    icon: Guitar,
    available: true,
  },
  {
    name: "Bass Elektrik",
    desc: "Ibanez / Cort + kabel jack",
    icon: Guitar,
    available: true,
  },
  {
    name: "Amplifier Gitar",
    desc: "Marshall / Roland combo amp",
    icon: Speaker,
    available: true,
  },
  {
    name: "Amplifier Bass",
    desc: "Hartke / Laney bass amp",
    icon: Speaker,
    available: true,
  },
  {
    name: "Keyboard / Synthesizer",
    desc: "Yamaha / Korg + stand",
    icon: Music,
    available: true,
  },
];

function handleWhatsApp(itemName: string) {
  const message = `Halo Admin Joel Music Studio\n\nSaya ingin menanyakan ketersediaan dan harga sewa:\n\n${itemName}\n\nTerima kasih`;
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${ADMIN_WA}?text=${encoded}`, "_blank");
}

export default function SewaPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back-sewa">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Joel Music Studio" className="h-8 w-8 rounded-md object-contain" />
            <span className="font-semibold text-sm" data-testid="text-sewa-title">Sewa Alat Musik</span>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold" data-testid="text-sewa-heading">Rental Alat Musik</h1>
          <p className="text-sm text-muted-foreground">
            Hubungi kami via WhatsApp untuk info harga dan ketersediaan
          </p>
        </div>

        <section>
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2" data-testid="text-section-alatmusik">
            <Guitar className="h-4 w-4 text-muted-foreground" />
            Alat Musik
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {alatMusikItems.map((item) => (
              <Card key={item.name} className="flex items-center justify-between gap-3 p-4" data-testid={`card-alat-${item.name.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center rounded-md bg-primary/10 p-2">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleWhatsApp(item.name)}
                  data-testid={`button-wa-alat-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <MessageCircle className="mr-1 h-3 w-3" />
                  Tanya
                </Button>
              </Card>
            ))}
          </div>
        </section>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center rounded-md bg-primary/10 p-2">
              <Phone className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Hubungi Kami</p>
              <p className="text-xs text-muted-foreground mb-2">
                Untuk info harga, ketersediaan, dan booking sewa silakan hubungi via WhatsApp
              </p>
              <Button size="sm" onClick={() => handleWhatsApp("Info lengkap sewa alat musik")} data-testid="button-wa-general">
                <MessageCircle className="mr-1 h-3 w-3" />
                Chat WhatsApp
              </Button>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row pb-4">
          <Button className="flex-1" variant="outline" onClick={() => navigate("/")} data-testid="button-back-home">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Home
          </Button>
          <Button className="flex-1" onClick={() => navigate("/booking")} data-testid="button-go-booking">
            <Music className="mr-2 h-4 w-4" />
            Booking Studio
          </Button>
        </div>
      </div>
    </div>
  );
}
