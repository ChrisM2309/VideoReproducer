import { MediaViewer } from "@/components/media-viewer";
import { publicAppConfig } from "@/lib/app-config";

export default function Home() {
  return <MediaViewer config={publicAppConfig} />;
}
