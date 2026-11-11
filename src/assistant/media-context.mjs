export const CONTEXT_SECONDS=180;
export const isUncaptionedMedia=r=>!!r?.hasMedia&&['image','video'].includes(r.type)&&!r.text?.trim();

// Temporal adjacency is only a suggestion, never a confirmed source link.
export function followingContext(media,following,isEligible){
  if(!isUncaptionedMedia(media))return null;
  const nearby=following.filter(r=>r&&r.id!==media.id&&r.month===media.month&&r.timestamp>=media.timestamp&&r.timestamp<=media.timestamp+CONTEXT_SECONDS&&r.text?.trim()&&isEligible(r));
  const quoted=nearby.find(r=>r.quotedId===media.id);
  const next=quoted||nearby.find(r=>!r.quotedId||r.quotedId===media.id);
  return next?{record:next,basis:quoted?'reply':'sequence'}:null;
}
