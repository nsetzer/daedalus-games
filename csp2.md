

synchronized clock

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

In practice, skiping an update multiple frames in a row
make make it look like the game is lagging. One way
to fix that is to only attempt to catch up or skip
steps on even-numbered steps, so that the frame rate
will never be less than half the expected frame rate.
If the delta is to large, request a full resync.


clock delay, handling messages

state

the server can kill an object
clients can process damage, but should wait for the server to indicate an object actually died.



