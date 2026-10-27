import Modal from './Modal';
import { PlayIcon } from './Icons';
import { parseVideo } from '../utils';

interface Props {
  title: string;
  url: string;
  onClose: () => void;
}

export default function VideoModal({ title, url, onClose }: Props) {
  const video = parseVideo(url);

  return (
    <Modal title={title} onClose={onClose} variant="dialog">
      {video.kind === 'iframe' && (
        <div className="video-frame">
          <iframe
            src={video.src}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      )}
      {video.kind === 'file' && (
        <video className="video-file" src={video.src} controls autoPlay playsInline />
      )}
      {video.kind === 'link' && (
        <div className="video-link">
          <p>This video opens on its own page.</p>
          <a className="btn btn-primary" href={video.src} target="_blank" rel="noopener noreferrer">
            <PlayIcon width={16} height={16} />
            Open video
          </a>
        </div>
      )}
    </Modal>
  );
}
