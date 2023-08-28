
Intro from
https://www.gabrielgambetta.com/lag-compensation.html

Introduction

The previous three articles explained a client-server game architecture which can be summarized as follows:

    Server gets inputs from all the clients, with timestamps

    Server processes inputs and updates world status

    Server sends regular world snapshots to all clients

    Client sends input and simulates their effects locally

    Client get world updates and

        Syncs predicted state to authoritative state

        Interpolates known past states for other entities

From a player’s point of view, this has two important consequences:

    Player sees himself in the present

    Player sees other entities in the past


0) interactive demos

* synchronized clock
    display a clock in each of the 3 panels, counting
    seconds since the server was started
    allow changing the latency or step delay

* fireworks
    allow changing latency only

* movement
    basic top down adventure style movement system
    allow changing latency only

* moving platform
    basic collision detection, physics
    include an elevator platform
    wheel only, up to jump, down to duck
    allow changing latency only

* lag compensation
    player1 or player 2 have a button to be ai controlled
    players are space invaders ships pointed at each other
    and can only move left or right
    players have a button to shoot a bullet

demo features
    adjust latency between client<->server
    adjust input delay (constant at 6 normally)
    adjust % packet loss (webrtc is reliable)


1) synchronized clock

The first step in implementing a fast paced multiplayer server is to
have clocks synchronized between the client and the server.

The server side of the code is very simple. Every 100 milliseconds
send a message to all connected clients the current value of the local step.


server:
```javascript

update(dt:float) {
    this.local_step += 1
    this.timer -= dt // subtract the delta since the last update
    if (this.timer < 0) { // check if the timer expired
        this.broadcast({type: "sync", step: this.local_step})
        this.timer += 0.1 // add 100ms to the timer
    }
}
```

the client side is more tricky.
The client has a world step and a local step. Both are incremented
by one on every update step.

When the client receives the sync message, it updates the world step
to be the maximum of the receive value and the current value.

On every update, the client can compare the world step and the local step.
Depending on how out of sync these values are, different things may be done.
If the values are completly out of sync, from a temporary network disconnect,
the client may request a full resync from the server. If the client
is only a few frames behind, it may choose to run two updates in a row.
if the client is a few frames ahead, it may choose to skip an update.

This ensure that the client is synchronized with the server, but doesnt
take in to account lag in the network. to solve that, the client delays
inputs by 100ms. If the game is running at 60 ticks per second, then
the client local step should always be behind the world step by 6 steps.

```javascript
onSyncMessage(msg) {
    this.world_step = max(msg.step, this.world_step)
}

update(dt: float) {
    delta = this.world_step - this.local_step
    if (delta > 6) {
        this.step()
        this.step()
    } else if (delta == 6) {
        this.step()
    } // else skip an update
}
```

In practice, this is a terrible way to implement this.
a better way would be to temporarily increase or decrease the framerate until the clocks are
synchronized again.

skiping an update multiple frames in a row
make make it look like the game is lagging. One way
to fix that is to only attempt to catch up or skip
steps on even-numbered steps, so that the frame rate
will never be less than half the expected frame rate.
If the delta is to large, request a full resync.

the better way will to increase or decrease the overall framerate
running at 58 or 62 frames per second until the steps is caught up.

2) rest of the owl

after implementing a synchronized clock, basically
two circles stacked on top, fill in the rest of the owl details

2) Receiving messages

1. Map Sync (full, partial, fragmentation)
2. Object Create
3. Object Input
4. Object Destroy

interpolation
    by sending only the user inputs and delaying by 100ms
    interpolate using past inputs, aka dead reckoning

3) Reconciliation

implement get/set state for the entity

implement get/set state for the world
the state is a dictionary mapping ObjectId => {object, state}

update_before
    pop input
    apply all input received for this step
update
update_after
    save state

4) Synchronization

a) full sync
b) partial sync

a) when a player joins mid way through, they will need to be sent the entire state of the game
b) do to floating point rounding errors, deltas will need to be periodically sent to clients

partial syncs are one solution to players with high ping
packets may be dropped because they are too old. the sync will update the client
to a known good starting point for applying new inputs.
the other possible solution is to make the receive buffer larger,
but this means reconciliation will need to be done over a larger window.
partial syncs reduce how many steps are needed for worst case reconciliation

partial syncs only need to be done for the same set of objects where bending could be used
bending may be disabled on the server

5) Bending

bending is an optional enhancement on top of  reconciliation, interpolation, extrapolation


6) partial syncs

server is authoritative
so even if a future event comes in that is valid, causes a reconciliation
the next partial sync that is sent out is the truth
there is no contradiction

are partial syncs position only?

7) delta syncs

6) Optimize Serialization


7) Lag compensation

The server knows at what time each message was received, and can estimate the latency for each client.
This information can be used to rewind the state to what a particular player was actually seeing
at a specific point in time.

clients should send a special object-input message with a lag compensation flag
the message indicates that the server should perform lag compensation when processing
the message
e.g. if its a collision, look at the state history for the two characters


10)
split axertc_client in axertc_client and axertc_daedalus_client

8) other notes

the server can kill an object
clients can process damage, but should wait for the server to indicate an object actually died.



demo client

two CspMaps, side by side
mock client
individual latency sliders for each side
client holds on to messages in an incomming queue, moves them to an outgoing queue