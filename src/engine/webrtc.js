
const byteSize = str => new Blob([str]).size


export function mean(seq) {

    let total = 0
    for (const v of seq) {
        total += v
    }
    return total / seq.length
}

export function stddev(seq, ddof = 1) {
    let m = mean(seq)
    if (seq.length < 2) {
        return 0
    }

    let total = 0
    for (const v of seq) {
        total += (v - m) * (v - m)
    }

    return Math.sqrt(total / (seq.length - ddof))
}

export function normalPolar(mean=0, stdev=1) {
    while (true) {

        const x = ((1 - Math.random()) * 2) - 1
        const y = (Math.random() * 2) - 1
        const s = x*x + y*y
        const t = Math.sqrt(-2 * Math.log(s)/s)
        if (s < 1) {
            return mean + stdev * (x * t)
        }
    }
}

function normalBoxMuller(mean=0, stdev=1) {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

export class CspRingBuffer {

    constructor(capacity) {

        this.capacity = capacity
        this.data = []
        for (let i = 0; i < capacity; i++) {
            this.data.push(null)
        }

    }

    set(index, value) {
        this.data[index % this.capacity] = value
    }

    get(index) {
        return this.data[index % this.capacity]
    }
}

export class RealTimeEchoClient {

    constructor(callback) {

        this.frame_index = 0
        // average total bytes sent and received over a 3 second window
        this.rb_xmit = new CspRingBuffer(60*3)
        this.total_sent = 0
        this.total_received = 0

        this.callback = callback

        this.latency_mean = 200
        this.latency_stddev = 75
        this.packet_lossrate = 0.0


        this.inputqueue = []
        this.inputqueue_capacity = 240
        for (let i=0; i < this.inputqueue_capacity; i++) {
            this.inputqueue.push([])
        }

        this.rb_xmit.set(this.frame_index, {sent:0, received:0})
    }

    send(obj) {

        let msg = JSON.stringify(obj)
        let nbytes = byteSize(msg)
        this.total_sent += nbytes
        this.rb_xmit.get(this.frame_index).sent += nbytes

        if (Math.random() < this.packet_lossrate) {
            return
        }

        const framerate = 60
        const latmin = this.latency_mean - this.latency_stddev
        const latmax = this.latency_mean + this.latency_stddev
        let latency = normalBoxMuller(this.latency_mean, this.latency_stddev)
        latency = Math.min(latmax, Math.max(latmin, latency))
        const offset = Math.round(framerate*latency/1000)
        const idx = (this.frame_index + offset) % this.inputqueue_capacity
        this.inputqueue[idx].push(msg)
    }

    update(dt) {
        this.frame_index += 1

        const info = this.rb_xmit.get(this.frame_index)
        if (!!info) {
            this.total_sent -= info.sent
            this.total_received -= info.received
        }
        this.rb_xmit.set(this.frame_index, {sent:0, received:0})

        const idx = (this.frame_index) % this.inputqueue_capacity
        if (this.inputqueue[idx].length > 0) {
            for (const msg of this.inputqueue[idx]) {
                this.onMessage(JSON.parse(msg))
            }
            this.inputqueue[idx] = []
        }
    }

    connected() {
        return true
    }

    onMessage(obj) {

        let nbytes = byteSize(JSON.stringify(obj))
        this.total_received += nbytes
        this.rb_xmit.get(this.frame_index).received += nbytes

        this.callback(obj)
    }

    stats() {
        return {sent: this.total_sent/3, received: this.total_received/3}
    }
}

export class RealTimeClient {

    constructor() {

        this.frame_index = 0

        this.pc = null;
        this.dc = null;
        this._open = false

        this.rb_xmit = new CspRingBuffer(60*3)
        this.total_sent = 0
        this.total_received = 0

    }

    createPeerConnection() {
        let config = {
            sdpSemantics: 'unified-plan'
        };

        // use a stun server
        config.iceServers = [{urls: ['stun:stun.l.google.com:19302']}];

        this.pc = new RTCPeerConnection(config);

        // register some listeners to help debugging
        this.pc.addEventListener('icegatheringstatechange', () => {
                let message = ' webrtc -> ' + this.pc.iceGatheringState;
                console.log(message);
            }, false);
        console.log(' webrtc -> ' + this.pc.iceGatheringState);

        this.pc.addEventListener('iceconnectionstatechange', () => {
            let message = ' webrtc -> ' + this.pc.iceConnectionState;
            console.log(message);
        }, false);
        console.log(' webrtc -> ' + this.pc.iceConnectionState);

        this.pc.addEventListener('signalingstatechange', () => {
            let message = ' webrtc -> ' + this.pc.signalingState;
            console.log(message);
        }, false);
        console.log(' webrtc -> ' + this.pc.signalingState);
    }

    negotiate(url, headers) {
        return this.pc.createOffer().then((offer) => {
            return this.pc.setLocalDescription(offer);
        }).then(() => {
            // wait for ICE gathering to complete
            return new Promise((resolve) => {
                if (this.pc.iceGatheringState === 'complete') {
                    resolve();
                } else {
                    let cbk = () =>  {
                        if (this.pc.iceGatheringState === 'complete') {
                            this.pc.removeEventListener('icegatheringstatechange', cbk);
                            resolve();
                        }
                    }
                    this.pc.addEventListener('icegatheringstatechange', cbk);
                }
            });
        }).then(() => {
            let offer = this.pc.localDescription;
            let codec;
            console.log(offer.sdp)
            return fetch(url, {
                body: JSON.stringify({
                    sdp: offer.sdp,
                    type: offer.type
                }),
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                method: 'POST'
            });
        }).then((response) => {
            console.log(response)
            if (response.ok) {
                return response.json();
            }
            response.text().then((message)=>{console.error(message)})
            throw new Error('Something went wrong.');
        }).then((answer) => {
            console.log(answer.sdp)
            return this.pc.setRemoteDescription(answer);
        }).catch((e) => {
            console.error(e);
        });
    }

    connect(url, headers) {

        this.createPeerConnection();

        // parameters can hold
        //    ordered: boolean
        //    maxRetransmits: integer
        //    maxPacketLifetime: milliseconds
        //
        // Ordered, reliable
        // {"ordered": true}
        //
        // Unordered, no retransmissions</option>
        // {"ordered": false, "maxRetransmits": 0}
        //
        // Unordered, 500ms lifetime</option>
        // {"ordered": false, "maxPacketLifetime": 500}

        let parameters = {"ordered": false, "maxRetransmits": 0}

        this.dc = this.pc.createDataChannel('chat', parameters);

        this.dc.onclose = () => {this._open = false; this.onClose.bind(this)}
        this.dc.onopen = () => {this._open = true; this.onOpen.bind(this)}
        this.dc.onmessage = this.onMessage.bind(this)

        this.negotiate(url, headers);


    }

    disconnect() {

        // close data channel
        if (this.dc) {
            this.dc.close();
        }

        const pc = this.pc

        // close transceivers
        if (pc) {
            if (pc?.getTransceivers) {
                pc.getTransceivers().forEach(function(transceiver) {
                    if (transceiver.stop) {
                        transceiver.stop();
                    }
                });
            }

            // close peer connection
            setTimeout(() => {
                pc.close();
            }, 500);
        }

        this.dc = null
        this.pc = null

    }

    onClose() {
    }

    onOpen() {
    }

    onMessage(evt) {
    }

    send(obj) {
        if (this._open) {
            const msg = JSON.stringify(obj)
            let nbytes = byteSize(msg)
            this.total_sent += nbytes
            this.rb_xmit.get(this.frame_index).sent += nbytes

            this.dc.send(msg)
        }
    }

    connected() {
        return this._open
    }

    update(dt) {
        this.frame_index += 1

        const info = this.rb_xmit.get(this.frame_index)
        if (!!info) {
            this.total_sent -= info.sent
            this.total_received -= info.received
        }
        this.rb_xmit.set(this.frame_index, {sent:0, received:0})
    }

    stats() {
        return {sent: this.total_sent/3, received: this.total_received/3}
    }
}

