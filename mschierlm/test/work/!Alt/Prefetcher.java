package parserutil;

import java.net.URL;
import java.util.LinkedList;
import java.util.Queue;

public class Prefetcher implements Runnable {
	
	int busy = 0;
	boolean finished=false;
	
	public class PrefetchEntry {
		private final String url;
		private final String cacheName;

		public PrefetchEntry(String url, String cacheName) {
			this.url = url;
			this.cacheName = cacheName;
		}
	}

	private final CachingDownloader cd;
	private Queue<PrefetchEntry> q = new LinkedList<PrefetchEntry>();
	
	public Prefetcher(CachingDownloader cd, int threadcount) {
		this.cd = cd;
		for(int i=0; i<threadcount; i++) {
			new Thread(this).start();
		}

	}
	
	public void run() { runPrefetch();}
	
	public synchronized void add(String url, String cacheName) {
		q.add(new PrefetchEntry(url, cacheName));
		notifyAll();
	}
	
	public synchronized void waitPrefetch() throws InterruptedException {
		while(busy != 0 || !q.isEmpty()) wait();
	}
	
	public synchronized void shutdown() throws InterruptedException {
		waitPrefetch();
		finished=true;
		notifyAll();
	}

	public void runPrefetch() {
		try {
			PrefetchEntry pe = null;
			while (!finished) {
				synchronized(this) {
					while (true) {
						if (finished) return;
						pe = q.poll();
						if (pe == null) {
							this.wait();
						} else {
							break;
						}
					}
					busy++;
				}
				cd.download(pe.url, pe.cacheName);
				synchronized(this) {
					busy--;
					notifyAll();
				}
			}
		} catch(Exception ex) {
			ex.printStackTrace();
		}
	}
}
