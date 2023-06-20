// TODO: center camera on hero at start
// TODO: boss door lock should also create a camera lock
//       lock keeps the camera centered on the arena
//       defeating the boss disables the lock

// Entity-Traits system
//   use generators to yield active entities matching some pattern
//   cache the result for 1 frame

// {visible: int}
// {health: int, hit: (power, direction)=>{}}
// {solid: int}
// {pressable: int, handlePress: ()=>{}}

// consider a 'view' object to be passed instead of ctx
// view has the w,h of the screen
// view = {w,h,ctx}


include './common.js'
include './title.js'
include './main.js'
include './resource.js'
include './mazegen.js'
