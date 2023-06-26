

export class RealTimeClient {

    constructor() {
        this.pc = null;
        this.dc = null;
        this._open = false
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
            this.dc.send(JSON.stringify(obj))
        }
    }

    connected() {
        return this._open
    }
}

