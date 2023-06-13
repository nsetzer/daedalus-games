daedalus=(function(){
    "use strict";
    const env={};
    const build_platform="web";
    const[StyleSheet,getStyleSheet,parseParameters,util]=(function(){
        function array_move(arr,p1,p2){
          if(p1<0){
            p1=0;
          }
          if(p2<0){
            p2=0;
          }
          if(p1>arr.length){
            p1=arr.length;
          }
          if(p2>arr.length){
            p2=arr.length;
          }
          if(p1==p2){
            return;
          }
          arr.splice(p2,0,arr.splice(p1,1)[0]);
          return;
        }
        function randomFloat(min,max){
          return Math.random()*(max-min)+min;
        }
        function randomInt(min,max){
          let _rnd=Math.random();
          let _min=Math.ceil(min);
          let _max=Math.floor(max);
          return Math.floor(_rnd*(_max-_min+1))+_min;
        }
        function object2style_helper(prefix,obj){
          const items=Object.keys(obj).map(key=>{
              const val=obj[key];
              const type=typeof(val);
              if(type==="object"){
                return object2style_helper(prefix+key+"-",val);
              }else{
                return[prefix+key+": "+val];
              }
            });
          let out=[];
          for(let i=0;i<items.length;i++)
          {
            out.concat(items[i]);
          }
          return out;
        }
        function object2style(obj){
          const arr=object2style_helper("",obj);
          return[].concat(arr).join(';');
        }
        function serializeParameters(obj){
          if(Object.keys(obj).length==0){
            return"";
          }
          const strings=Object.keys(obj).reduce((a,k)=>{
              if(obj[k]===null||obj[k]===undefined){

              }else if(Array.isArray(obj[k])){
                for(let i=0;i<obj[k].length;i++)
                {
                  a.push(encodeURIComponent(k)+'='+encodeURIComponent(obj[k][i]));
                  
                }
              }else{
                a.push(encodeURIComponent(k)+'='+encodeURIComponent(obj[k]));
              }
              return a;
            },[]);
          return'?'+strings.join('&');
        }
        function parseParameters(text=undefined){
          let match;
          let search=/([^&=]+)=?([^&]*)/g;
          let decode=s=>decodeURIComponent(s.replace(/\+/g," "));
          let search_term=(new URL(window.location.protocol+"//"+window.location.hostname+window.daedalus_location)).search;
          
          let query=(text===undefined)?search_term.substring(1):text;
          let urlParams={};
          while(match=search.exec(query)){
            let value=decode(match[2]);
            let key=decode(match[1]);
            if(urlParams[key]===undefined){
              urlParams[key]=[value];
            }else{
              urlParams[key].push(value);
            }
          }
          return urlParams;
        }
        function isFunction(x){
          return(x instanceof Function);
        }
        function joinpath(...parts){
          let str="";
          for(let i=0;i<parts.length;i++)
          {
            if(!str.endsWith("/")&&!parts[i].startsWith("/")){
              str+="/";
            }
            str+=parts[i];
          }
          return str;
        }
        function splitpath(path){
          const parts=path.split('/');
          if(parts.length>0&&parts[parts.length-1].length===0){
            parts.pop();
          }
          return parts;
        }
        function dirname(path){
          const parts=path.split('/');
          while(parts.length>0&&parts[parts.length-1].length===0){
            parts.pop();
          }
          return joinpath(...parts.slice(0,-1));
        }
        function splitext(name){
          const index=name.lastIndexOf('.');
          if(index<=0||name[index-1]=='/'){
            return[name,''];
          }else{
            return[name.slice(0,index),name.slice(index)];
          }
        }
        let css_sheet=null;
        let selector_names={};
        function generateStyleSheetName(){
          const chars='abcdefghijklmnopqrstuvwxyz';
          let name;
          do {
            name="css-";
            for(let i=0;i<6;i++)
            {
              let c=chars[randomInt(0,chars.length-1)];
              name+=c;
            }
          } while (name in selector_names)
          return name;
        }
        function shuffle(array){
          let currentIndex=array.length,temporaryValue,randomIndex;
          while(0!==currentIndex){
            randomIndex=Math.floor(Math.random()*currentIndex);
            currentIndex-=1;
            temporaryValue=array[currentIndex];
            array[currentIndex]=array[randomIndex];
            array[randomIndex]=temporaryValue;
          }
          return array;
        }
        function StyleSheet(...args){
          let name;
          let style;
          let selector;
          if(args.length===1){
            name=generateStyleSheetName();
            selector="."+name;
            style=args[0];
          }else if(args.length===2){
            selector=args[0];
            style=args[1];
            name=selector;
          }
          if(css_sheet===null){
            css_sheet=document.createElement('style');
            css_sheet.type='text/css';
            document.head.appendChild(css_sheet);
          }
          const text=object2style(style);
          selector_names[name]=style;
          css_sheet.sheet.insertRule(selector+" {"+text+"}",css_sheet.sheet.rules.length);
          
          return name;
        }
        function getStyleSheet(name){
          return selector_names[name];
        }
        function perf_timer(){
          return performance.now();
        }
        const util={array_move,randomInt,randomFloat,object2style,serializeParameters,
                  parseParameters,isFunction,joinpath,splitpath,dirname,splitext,shuffle,
                  perf_timer};
        return[StyleSheet,getStyleSheet,parseParameters,util];
      })();
    const[ButtonElement,DomElement,DraggableList,DraggableListItem,HeaderElement,
          LinkElement,ListElement,ListItemElement,TextElement,TextInputElement]=(function(
            ){
        let element_uid=0;
        function generateElementId(){
          const chars='abcdefghijklmnopqrstuvwxyz';
          let name;
          name="-";
          for(let i=0;i<6;i++)
          {
            let c=chars[util.randomInt(0,chars.length-1)];
            name+=c;
          }
          return name+"-"+(element_uid++);
        }
        class DomElement{
          constructor(type="div",props=undefined,children=undefined){
            if(type===undefined){
              throw`DomElement type is undefined. super called with ${arguments.length} arguments`;
              
            }
            this.type=type;
            this.props=props??{};
            this.children=children??[];
            if(this.props.id===undefined){
              this.props.id=this.constructor.name+generateElementId();
            }
            this._$dirty=true;
            this.state={};
            this.attrs={};
            this._$fiber=null;
            Object.getOwnPropertyNames(this.__proto__).filter(key=>key.startsWith(
                              "on")).forEach(key=>{
                this.props[key]=this[key].bind(this);
              });
          }
          _update(element,debug=false){

          }
          update(debug=false){
            this._update(this,debug);
          }
          updateState(state,doUpdate){
            const newState={...this.state,...state};
            if(doUpdate!==false){
              if((doUpdate===true)||(this.elementUpdateState===undefined)||(this.elementUpdateState(
                                      this.state,newState)!==false)){
                this.update();
              }
            }
            this.state=newState;
          }
          updateProps(props,doUpdate){
            const newProps={...this.props,...props};
            if(doUpdate!==false){
              if((doUpdate===true)||(this.elementUpdateProps===undefined)||(this.elementUpdateProps(
                                      this.props,newProps)!==false)){
                this.update();
              }
            }
            this.props=newProps;
          }
          appendChild(childElement){
            if(!childElement||!childElement.type){
              console.log({message:"invalid child",child:childElement});
              throw"appendChild Failed: child is null or type not set";
            }
            if(typeof this.children==="string"){
              this.children=[this.children];
            }else if(typeof this.children==="undefined"){
              this.children=[];
            }
            this.children.push(childElement);
            this.update();
            return childElement;
          }
          insertChild(index,childElement){
            if(!childElement||!childElement.type){
              throw"invalid child";
            }
            if(index<0){
              index+=this.children.length+1;
            }
            if(index<0||index>this.children.length){
              console.error("invalid index: "+index);
              return;
            }
            if(typeof this.children==="string"){
              this.children=[this.children];
            }else if(typeof this.children==="undefined"){
              this.children=[];
            }
            this.children.splice(index,0,childElement);
            this.update();
            return childElement;
          }
          removeChildAtIndex(index){
            if(index>=0){
              this.children.splice(index,1);
              this.update();
            }else{
              console.error("child not in list");
            }
          }
          removeChild(childElement){
            if(!childElement||!childElement.type){
              throw"invalid child";
            }
            this.removeChildAtIndex(this.children.indexOf(childElement));
          }
          removeChildren(){
            this.children.splice(0,this.children.length);
            this.update();
          }
          replaceChild(childElement,newChildElement){
            const index=this.children.indexOf(childElement);
            if(index>=0){
              this.children[index]=newChildElement;
              this.update();
            }
          }
          addClassName(cls){
            let props;
            if(this.props.className==undefined||this.props.className==null){
              props={className:cls};
            }else if(Array.isArray(this.props.className)){
              if(this.hasClassName(cls)){
                return;
              }
              props={className:[cls,...this.props.className]};
            }else{
              if(this.props.className===cls){
                return;
              }
              props={className:[cls,this.props.className]};
            }
            this.updateProps(props);
          }
          removeClassName(cls){
            let props;
            if(Array.isArray(this.props.className)){
              props={className:this.props.className.filter(x=>(x!==cls))};
              if(props.className.length===this.props.className.length){
                return;
              }
              this.updateProps(props);
            }else if(this.props.className===cls){
              props={className:null};
              this.updateProps(props);
            }
          }
          hasClassName(cls){
            let props;
            if(Array.isArray(this.props.className)){
              return this.props.className.filter(x=>x===cls).length>0;
            }
            return this.props.className===cls;
          }
          getDomNode(){
            if(this._$fiber==null){
              console.error(this);
            }
            return this._$fiber&&this._$fiber.dom;
          }
          isMounted(){
            return this._$fiber!==null;
          }
        }
        class TextElement extends DomElement {
          constructor(text,props={}){
            super("TEXT_ELEMENT",{'nodeValue':text,...props},[]);
          }
          setText(text){
            this.props={'nodeValue':text};
            this.update();
          }
          getText(){
            return this.props.nodeValue;
          }
        }
        class LinkElement extends DomElement {
          constructor(text,url){
            super("div",{className:LinkElement.style.link,title:url},[new TextElement(
                                  text)]);
            this.state={url};
          }
          onClick(){
            if(this.state.url.startsWith('http')){
              window.open(this.state.url,'_blank');
            }else{
              history.pushState({},"",this.state.url);
            }
          }
        }
        LinkElement.style={link:'dcs-16e24fb6-0'};
        class ListElement extends DomElement {
          constructor(){
            super("ul",{},[]);
          }
        }
        class ListItemElement extends DomElement {
          constructor(item){
            super("li",{},[item]);
          }
        }
        class HeaderElement extends DomElement {
          constructor(text=""){
            super("h1",{},[]);
            this.node=this.appendChild(new TextElement(text));
          }
          setText(text){
            this.node.setText(text);
          }
        }
        class ButtonElement extends DomElement {
          constructor(text,onClick){
            super("button",{'onClick':onClick},[new TextElement(text)]);
          }
          setText(text){
            this.children[0].setText(text);
          }
          getText(){
            return this.children[0].props.nodeValue;
          }
        }
        class TextInputElement extends DomElement {
          constructor(text,_,submit_callback){
            super("input",{value:text,type:"text"},[]);
            this.attrs={submit_callback};
          }
          setText(text){
            this.getDomNode().value=text;
          }
          getText(){
            return this.getDomNode().value;
          }
          onChange(event){

          }
          onPaste(event){

          }
          onKeyUp(event){
            if(event.key=="Enter"){
              if(this.attrs.submit_callback){
                this.attrs.submit_callback(this.getText());
              }
            }
          }
        }
        function swap(nodeA,nodeB){
          if(!nodeA||!nodeB){
            return;
          }
          const parentA=nodeA.parentNode;
          const siblingA=nodeA.nextSibling===nodeB?nodeA:nodeA.nextSibling;
          nodeB.parentNode.insertBefore(nodeA,nodeB);
          parentA.insertBefore(nodeB,siblingA);
        }
        function isAbove(nodeA,nodeB){
          if(!nodeA||!nodeB){
            return false;
          }
          const rectA=nodeA.getBoundingClientRect();
          const rectB=nodeB.getBoundingClientRect();
          const a=rectA.top+rectA.height/2;
          const b=rectB.top+rectB.height/2;
          return a<b;
        }
        function childIndex(node){
          if(node===null){
            return 0;
          }
          let count=0;
          while((node=node.previousSibling)!=null){
            count++;
          }
          return count;
        }
        const placeholder='dcs-16e24fb6-1';
        class DraggableListItem extends DomElement {
          constructor(){
            super("div",{},[]);
          }
          onTouchStart(event){
            this.attrs.parent.handleChildDragBegin(this,event);
          }
          onTouchMove(event){
            this.attrs.parent.handleChildDragMove(this,event);
          }
          onTouchEnd(event){
            this.attrs.parent.handleChildDragEnd(this,{target:this.getDomNode()});
            
          }
          onTouchCancel(event){
            this.attrs.parent.handleChildDragEnd(this,{target:this.getDomNode()});
            
          }
          onMouseDown(event){
            this.attrs.parent.handleChildDragBegin(this,event);
          }
          onMouseMove(event){
            this.attrs.parent.handleChildDragMove(this,event);
          }
          onMouseLeave(event){
            this.attrs.parent.handleChildDragEnd(this,event);
          }
          onMouseUp(event){
            this.attrs.parent.handleChildDragEnd(this,event);
          }
        }
        class DraggableList extends DomElement {
          constructor(){
            super("div",{},[]);
            this.attrs={x:null,y:null,placeholder:null,placeholderClassName:placeholder,
                          draggingEle:null,isDraggingStarted:false,indexStart:-1,lockX:true,swipeScrollTimer:null};
            
          }
          setPlaceholderClassName(className){
            this.attrs.placeholderClassName=className;
          }
          handleChildDragBegin(child,event){
            if(!!this.attrs.draggingEle){
              console.error("running drag cancel because previous did not finish");
              
              this.handleChildDragCancel();
            }
            let org_event=event;
            let evt=(((event)||{}).touches||((((event)||{}).originalEvent)||{}).touches);
            
            if(evt){
              event=evt[0];
            }
            this.attrs.draggingEle=child.getDomNode();
            if(!this.attrs.draggingEle){
              console.error("no element set for drag");
              return false;
            }
            this.attrs.draggingChild=child;
            this.attrs.indexStart=childIndex(this.attrs.draggingEle);
            if(this.attrs.indexStart<0){
              console.error("drag begin failed for child");
              this.attrs.draggingEle=null;
              this.attrs.indexStart=-1;
              return false;
            }
            const rect=this.attrs.draggingEle.getBoundingClientRect();
            this.attrs.x=event.clientX-rect.left;
            this.attrs.y=event.pageY+window.scrollY;
            this.attrs.eventSource=child;
            return true;
          }
          handleChildDragMoveImpl(pageX,pageY){
            const rect=this.attrs.draggingEle.parentNode.getBoundingClientRect();
            
            pageY-=rect.top+window.scrollY;
            const draggingRect=this.attrs.draggingEle.getBoundingClientRect();
            if(this.attrs.indexStart<0){
              console.error("drag move failed for child");
              return false;
            }
            if(!this.attrs.isDraggingStarted){
              this.attrs.isDraggingStarted=true;
              this.attrs.placeholder=document.createElement('div');
              this.attrs.placeholder.classList.add(this.attrs.placeholderClassName);
              
              this.attrs.draggingEle.parentNode.insertBefore(this.attrs.placeholder,
                              this.attrs.draggingEle.nextSibling);
              this.attrs.placeholder.style.height=`${this.attrs.draggingEle.clientHeight}px`;
              
            }
            this.attrs.draggingEle.style.position='absolute';
            let ypos=pageY-(this.attrs.draggingEle.clientHeight/2);
            this.attrs.draggingEle.style.top=`${ypos}px`;
            if(!this.attrs.lockX){
              this.attrs.draggingEle.style.left=`${pageX-this.attrs.x}px`;
            }
            const prevEle=this.attrs.draggingEle.previousElementSibling;
            const nextEle=this.attrs.placeholder.nextElementSibling;
            if(prevEle&&isAbove(this.attrs.draggingEle,prevEle)){
              swap(this.attrs.placeholder,this.attrs.draggingEle);
              swap(this.attrs.placeholder,prevEle);
              const a=childIndex(prevEle)-1;
              const b=childIndex(this.attrs.draggingEle);
              prevEle._$fiber.element.setIndex(a);
              this.attrs.draggingEle._$fiber.element.setIndex(b);
            }else if(nextEle&&isAbove(nextEle,this.attrs.draggingEle)){
              swap(nextEle,this.attrs.placeholder);
              swap(nextEle,this.attrs.draggingEle);
              const a=childIndex(nextEle);
              const b=childIndex(this.attrs.draggingEle);
              nextEle._$fiber.element.setIndex(a);
              this.attrs.draggingEle._$fiber.element.setIndex(b);
            }
            return true;
          }
          _handleAutoScroll(dy){
            const rate=15;
            const step=rate*dy;
            let _y=window.pageYOffset;
            window.scrollBy(0,step);
            if(_y!=window.pageYOffset){
              let total_step=window.pageYOffset-_y;
              this.attrs.y+=total_step;
              this.attrs.autoScrollY+=total_step;
              this.handleChildDragMoveImpl(this.attrs.autoScrollX,this.attrs.autoScrollY);
              
            }
          }
          _handleChildDragAutoScroll(evt){
            const _rect=this.attrs.draggingEle.parentNode.getBoundingClientRect();
            
            let node=this.getDomNode();
            const lstTop=window.scrollY+_rect.top;
            let top=window.scrollY+_rect.top;
            let bot=top+window.innerHeight-lstTop;
            let y=Math.floor(evt.pageY-node.offsetTop-window.scrollY);
            let h=this.attrs.draggingEle.clientHeight;
            if(y<top+h){
              this.attrs.autoScrollX=Math.floor(evt.pageX);
              this.attrs.autoScrollY=Math.floor(evt.pageY);
              if(this.attrs.swipeScrollTimer===null){
                this.attrs.swipeScrollTimer=setInterval(()=>{
                    this._handleAutoScroll(-1);
                  },33);
              }
            }else if(y>bot-h*2){
              this.attrs.autoScrollX=Math.floor(evt.pageX);
              this.attrs.autoScrollY=Math.floor(evt.pageY);
              if(this.attrs.swipeScrollTimer===null){
                this.attrs.swipeScrollTimer=setInterval(()=>{
                    this._handleAutoScroll(1);
                  },33);
              }
            }else if(this.attrs.swipeScrollTimer!==null){
              clearInterval(this.attrs.swipeScrollTimer);
              this.attrs.swipeScrollTimer=null;
            }
          }
          handleChildDragMove(child,event){
            if(!this.attrs.draggingEle){
              return false;
            }
            if(this.attrs.draggingEle!==child.getDomNode()){
              return false;
            }
            let org_event=event;
            let evt=(((event)||{}).touches||((((event)||{}).originalEvent)||{}).touches);
            
            if(evt){
              event=evt[0];
            }
            this._handleChildDragAutoScroll(event);
            let x=Math.floor(event.pageX);
            let y=Math.floor(event.pageY);
            if(this.attrs._px!==x||this.attrs._py!==y){
              this.attrs._px=x;
              this.attrs._py=y;
              return this.handleChildDragMoveImpl(x,y);
            }
          }
          handleChildDragEnd(child,event){
            return this.handleChildDragCancel();
          }
          handleChildDragCancel(doUpdate=true){
            this.attrs.placeholder&&this.attrs.placeholder.parentNode.removeChild(
                          this.attrs.placeholder);
            const indexEnd=childIndex(this.attrs.draggingEle);
            if(this.attrs.indexStart>=0&&this.attrs.indexStart!==indexEnd){
              this.updateModel(this.attrs.indexStart,indexEnd);
            }
            if(this.attrs.draggingEle){
              this.attrs.draggingEle.style.removeProperty('top');
              this.attrs.draggingEle.style.removeProperty('left');
              this.attrs.draggingEle.style.removeProperty('position');
            }
            if(this.attrs.swipeScrollTimer!==null){
              clearInterval(this.attrs.swipeScrollTimer);
              this.attrs.swipeScrollTimer=null;
            }
            const success=this.attrs.draggingEle!==null;
            this.attrs.x=null;
            this.attrs.y=null;
            this.attrs.draggingEle=null;
            this.attrs.isDraggingStarted=false;
            this.attrs.placeholder=null;
            this.attrs.indexStart=-1;
            return success;
          }
          updateModel(indexStart,indexEnd){
            this.children.splice(indexEnd,0,this.children.splice(indexStart,1)[0]);
            
          }
          debugString(){
            let str="";
            if(this.attrs.isDraggingStarted){
              str+=" dragging";
            }else{
              str+=" not dragging";
            }
            if(this.attrs.draggingEle){
              str+='elem';
            }
            if(this.attrs.x||this.attrs.y){
              str+=` x:${this.attrs.x}, y:${this.attrs.y}`;
            }
            return str;
          }
        }
        return[ButtonElement,DomElement,DraggableList,DraggableListItem,HeaderElement,
                  LinkElement,ListElement,ListItemElement,TextElement,TextInputElement];
      })();
    const[]=(function(){
        if(location){
          window.daedalus_location=location.pathname+location.search+location.hash;
          
        }
        function _sendEvent(path){
          const myEvent=new CustomEvent('locationChangedEvent',{detail:{path:path},
                          bubbles:true,cancelable:true,composed:false});
          window.daedalus_location=path;
          window.dispatchEvent(myEvent);
        }
        history._pushState=history.pushState;
        history.pushState=(state,title,path)=>{
          history._pushState(state,title,path);
          _sendEvent(path);
        };
        window.addEventListener('popstate',(event)=>{
            _sendEvent(location.pathname+location.search+location.hash);
          });
        return[];
      })();
    const[AuthenticatedRouter,Router,locationMatch,patternCompile,patternToRegexp]=(
          function(){
        function patternCompile(pattern){
          const arr=pattern.split('/');
          let tokens=[];
          for(let i=1;i<arr.length;i++)
          {
            let part=arr[i];
            if(part.startsWith(':')){
              if(part.endsWith('?')){
                tokens.push({param:true,name:part.substr(1,part.length-2)});
              }else if(part.endsWith('+')){
                tokens.push({param:true,name:part.substr(1,part.length-2)});
              }else if(part.endsWith('*')){
                tokens.push({param:true,name:part.substr(1,part.length-2)});
              }else{
                tokens.push({param:true,name:part.substr(1)});
              }
            }else{
              tokens.push({param:false,value:part});
            }
          }
          return(items,query_items)=>{
            let location='';
            for(let i=0;i<tokens.length;i++)
            {
              location+='/';
              if(tokens[i].param){
                location+=items[tokens[i].name];
              }else{
                location+=tokens[i].value;
              }
            }
            if(!!query_items){
              location+=util.serializeParameters(query_items);
            }
            return location;
          };
        }
        function patternToRegexp(pattern,exact=true){
          const arr=pattern.split('/');
          let re="^";
          let tokens=[];
          for(let i=exact?1:0;i<arr.length;i++)
          {
            let part=arr[i];
            if(i==0&&exact===false){

            }else{
              re+="\\/";
            }
            if(part.startsWith(':')){
              if(part.endsWith('?')){
                tokens.push(part.substr(1,part.length-2));
                re+="([^\\/]*)";
              }else if(part.endsWith('+')){
                tokens.push(part.substr(1,part.length-2));
                re+="?(.+)";
              }else if(part.endsWith('*')){
                tokens.push(part.substr(1,part.length-2));
                re+="?(.*)";
              }else{
                tokens.push(part.substr(1));
                re+="([^\\/]+)";
              }
            }else{
              re+=part;
            }
          }
          if(re!=="^\\/"){
            re+="\\/?";
          }
          re+="$";
          return{re:new RegExp(re,"i"),text:re,tokens};
        }
        function locationMatch(obj,location){
          obj.re.lastIndex=0;
          let arr=location.match(obj.re);
          if(arr==null){
            return null;
          }
          let result={};
          for(let i=1;i<arr.length;i++)
          {
            result[obj.tokens[i-1]]=arr[i];
          }
          return result;
        }
        function patternMatch(pattern,location){
          return locationMatch(patternToRegexp(pattern),location);
        }
        class Router{
          constructor(container,default_callback){
            if(!container){
              throw'invalid container';
            }
            this.container=container;
            this.default_callback=default_callback;
            this.routes=[];
            this.current_index=-2;
            this.current_location=null;
            this.match=null;
          }
          handleLocationChanged(location){
            let auth=this.isAuthenticated();
            let index=0;
            while(index<this.routes.length){
              const item=this.routes[index];
              if(!auth&&item.auth){
                index+=1;
                continue;
              }
              const match=locationMatch(item.re,(new URL(window.location.protocol+"//"+window.location.hostname+location)).pathname);
              
              if(match!==null){
                let fn=(element)=>this.setElement(index,location,match,element);
                if(this.doRoute(item,fn,match)){
                  return;
                }
              }
              index+=1;
            }
            let fn=(element)=>this.setElement(-1,location,null,element);
            this.default_callback(fn);
            return;
          }
          doRoute(item,fn,match){
            item.callback(fn,match);
            return true;
          }
          setElement(index,location,match,element){
            if(!!element){
              if(index!=this.current_index){
                this.container.children=[element];
                this.container.update();
              }
              if(this.current_location!==location){
                this.setMatch(match);
                element.updateState({match:match});
              }
              this.current_index=index;
            }else{
              this.container.children=[];
              this.current_index=-1;
              this.container.update();
            }
            this.current_location=location;
          }
          addRoute(pattern,callback){
            const re=patternToRegexp(pattern);
            this.routes.push({pattern,callback,re});
          }
          setDefaultRoute(callback){
            this.default_callback=callback;
          }
          setMatch(match){
            this.match=match;
          }
          clear(){
            this.container.children=[];
            this.current_index=-1;
            this.current_location=null;
            this.container.update();
          }
          isAuthenticated(){
            return false;
          }
        }
        Router.instance=null;
        class AuthenticatedRouter extends Router {
          constructor(container,route_list,default_callback){
            super(container,route_list,default_callback);
            this.authenticated=false;
          }
          doRoute(item,fn,match){
            let has_auth=this.isAuthenticated();
            if(item.auth===true&&item.noauth===undefined){
              if(!!has_auth){
                item.callback(fn,match);
                return true;
              }else if(item.fallback!==undefined){
                history.pushState({},"",item.fallback);
                return true;
              }
            }
            if(item.auth===undefined&&item.noauth===true){
              if(!has_auth){
                item.callback(fn,match);
                return true;
              }else if(item.fallback!==undefined){
                history.pushState({},"",item.fallback);
                return true;
              }
            }
            if(item.auth===undefined&&item.noauth===undefined){
              item.callback(fn,match);
              return true;
            }
            return false;
          }
          isAuthenticated(){
            return this.authenticated;
          }
          setAuthenticated(value){
            this.authenticated=!!value;
          }
          addAuthRoute(pattern,callback,fallback){
            const re=patternToRegexp(pattern);
            this.routes.push({pattern,callback,auth:true,fallback,re});
          }
          addNoAuthRoute(pattern,callback,fallback){
            const re=patternToRegexp(pattern);
            this.routes.push({pattern,callback,noauth:true,fallback,re});
          }
        }
        return[AuthenticatedRouter,Router,locationMatch,patternCompile,patternToRegexp];
        
      })();
    const[downloadFile,uploadFile]=(function(){
        function saveBlob(blob,fileName){
          let a=document.createElement('a');
          a.href=window.URL.createObjectURL(blob);
          a.download=fileName;
          a.dispatchEvent(new MouseEvent('click'));
        }
        function downloadFile(url,headers={},params={},success=null,failure=null){
        
          const postData=new FormData();
          const queryString=util.serializeParameters(params);
          const xhr=new XMLHttpRequest();
          xhr.open('GET',url+queryString);
          for(let key in headers){
            xhr.setRequestHeader(key,headers[key]);
          }
          xhr.responseType='blob';
          xhr.onload=function(this_,event_){
            let blob=this_.target.response;
            if(!blob||this_.target.status!=200){
              if(failure!==null){
                failure({status:this_.target.status,blob});
              }
            }else{
              let contentDispo=xhr.getResponseHeader('Content-Disposition');
              console.log(xhr);
              let fileName;
              if(contentDispo!==null){
                fileName=contentDispo.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)[
                                1];
              }
              if(!fileName){
                console.error("filename not found in xhr request header 'Content-Disposition'");
                
                let parts;
                parts=xhr.responseURL.split('/');
                parts=parts[parts.length-1].split('?');
                fileName=parts[0]||'resource.bin';
              }
              saveBlob(blob,fileName);
              if(success!==null){
                success({url,fileName,blob});
              }
            }
          };
          xhr.send(postData);
        }
        function _uploadFileImpl(elem,urlbase,headers={},params={},success=null,failure=null,
                  progress=null){
          let queryString=util.serializeParameters(params);
          let arrayLength=elem.files.length;
          for(let i=0;i<arrayLength;i++)
          {
            let file=elem.files[i];
            let bytesTransfered=0;
            let url;
            if(urlbase.endsWith('/')){
              url=urlbase+file.name;
            }else{
              url=urlbase+'/'+file.name;
            }
            url+=queryString;
            let xhr=new XMLHttpRequest();
            xhr.open('POST',url,true);
            for(let key in headers){
              xhr.setRequestHeader(key,headers[key]);
            }
            xhr.upload.onprogress=function(event){
              if(event.lengthComputable){
                if(progress!==null){
                  bytesTransfered=event.loaded;
                  progress({bytesTransfered,fileSize:file.size,fileName:file.name,
                                          finished:false});
                }
              }
            };
            xhr.onreadystatechange=function(){
              if(xhr.readyState==4&&xhr.status==200){
                if(success!==null){
                  let params={fileName:file.name,url,lastModified:file.lastModified,
                                      size:file.size,type:file.type};
                  success(params);
                  if(progress!==null){
                    progress({bytesTransfered:file.size,fileSize:file.size,fileName:file.name,
                                              finished:true});
                  }
                }
              }else if(xhr.status>=400){
                if(failure!==null){
                  let params={fileName:file.name,url,status:xhr.status};
                  failure(params);
                  if(progress!==null){
                    progress({bytesTransfered,fileSize:file.size,fileName:file.name,
                                              finished:true});
                  }
                }
              }else{
                console.log("xhr status changed: "+xhr.status);
              }
            };
            if(progress!==null){
              progress({bytesTransfered,fileSize:file.size,fileName:file.name,finished:false,
                                  first:true});
            }
            let fd=new FormData();
            fd.append('upload',file);
            xhr.send(fd);
          }
        }
        function uploadFile(urlbase,headers={},params={},success=null,failure=null,
                  progress=null){
          let element=document.createElement('input');
          element.type='file';
          element.hidden=true;
          element.onchange=(event)=>{
            _uploadFileImpl(element,urlbase,headers,params,success,failure,progress);
            
          };
          element.dispatchEvent(new MouseEvent('click'));
        }
        return[downloadFile,uploadFile];
      })();
    const[OSName,platform]=(function(){
        let nVer=navigator.appVersion;
        let nAgt=navigator.userAgent;
        let browserName=navigator.appName;
        let fullVersion=''+parseFloat(navigator.appVersion);
        let majorVersion=parseInt(navigator.appVersion,10);
        let nameOffset,verOffset,ix;
        if((verOffset=nAgt.indexOf("Opera"))!=-1){
          browserName="Opera";
          fullVersion=nAgt.substring(verOffset+6);
          if((verOffset=nAgt.indexOf("Version"))!=-1){
            fullVersion=nAgt.substring(verOffset+8);
          }
        }else if((verOffset=nAgt.indexOf("MSIE"))!=-1){
          browserName="Microsoft Internet Explorer";
          fullVersion=nAgt.substring(verOffset+5);
        }else if((verOffset=nAgt.indexOf("Chrome"))!=-1){
          browserName="Chrome";
          fullVersion=nAgt.substring(verOffset+7);
        }else if((verOffset=nAgt.indexOf("Safari"))!=-1){
          browserName="Safari";
          fullVersion=nAgt.substring(verOffset+7);
          if((verOffset=nAgt.indexOf("Version"))!=-1){
            fullVersion=nAgt.substring(verOffset+8);
          }
        }else if((verOffset=nAgt.indexOf("Firefox"))!=-1){
          browserName="Firefox";
          fullVersion=nAgt.substring(verOffset+8);
        }else if((nameOffset=nAgt.lastIndexOf(' ')+1)<(verOffset=nAgt.lastIndexOf(
                          '/'))){
          browserName=nAgt.substring(nameOffset,verOffset);
          fullVersion=nAgt.substring(verOffset+1);
          if(browserName.toLowerCase()==browserName.toUpperCase()){
            browserName=navigator.appName;
          }
        }
        if((ix=fullVersion.indexOf(";"))!=-1){
          fullVersion=fullVersion.substring(0,ix);
        }
        if((ix=fullVersion.indexOf(" "))!=-1){
          fullVersion=fullVersion.substring(0,ix);
        }
        majorVersion=parseInt(''+fullVersion,10);
        if(isNaN(majorVersion)){
          fullVersion=''+parseFloat(navigator.appVersion);
          majorVersion=parseInt(navigator.appVersion,10);
        }
        let OSName="Unknown OS";
        if(navigator.appVersion.indexOf("Win")!=-1){
          OSName="Windows";
        }
        if(navigator.appVersion.indexOf("Mac")!=-1){
          OSName="MacOS";
        }
        if(navigator.appVersion.indexOf("X11")!=-1){
          OSName="UNIX";
        }
        if(navigator.appVersion.indexOf("Linux")!=-1){
          OSName="Linux";
        }
        function getDefaultFontSize(parentElement){
          parentElement=parentElement||document.body;
          let div=document.createElement('div');
          div.style.width="1000em";
          parentElement.appendChild(div);
          let pixels=div.offsetWidth/1000;
          parentElement.removeChild(div);
          return pixels;
        }
        const isMobile={Android:function(){
            return navigator.userAgent.match(/Android/i);
          },BlackBerry:function(){
            return navigator.userAgent.match(/BlackBerry/i);
          },iOS:function(){
            return navigator.userAgent.match(/iPhone|iPad|iPod/i);
          },Opera:function(){
            return navigator.userAgent.match(/Opera Mini/i);
          },Windows:function(){
            return navigator.userAgent.match(/IEMobile/i)||navigator.userAgent.match(
                          /WPDesktop/i);
          },any:function(){
            return(isMobile.Android()||isMobile.BlackBerry()||isMobile.iOS()||isMobile.Opera(
                            )||isMobile.Windows());
          }};
        const platform={OSName,browser:browserName,fullVersion,majorVersion,appName:navigator.appName,
                  userAgent:navigator.userAgent,platform:build_platform||'web',isAndroid:build_platform==='android',
                  isQt:build_platform==='qt',isMobile:(!!isMobile.any())};
        return[OSName,platform];
      })();
    const[render,render_update]=(function(){
        if(window.requestIdleCallback===undefined){
          window.requestIdleCallback=(callback,options)=>{
            setTimeout(()=>{
                callback();
              },0);
          };
        }
        let workstack=[];
        let deletions=[];
        let deletions_removed=new Set();
        let updatequeue=[];
        let wipRoot=null;
        let currentRoot=null;
        let workLoopActive=false;
        let workCounter=0;
        function render(container,element){
          wipRoot={type:"ROOT",dom:container,props:{},children:[element],_fibers:[
                        ],alternate:currentRoot};
          workstack.push(wipRoot);
          if(!workLoopActive){
            workLoopActive=true;
            setTimeout(workLoop,0);
          }
        }
        function render_update(element,debug=false){
          if(!element._$dirty&&element._$fiber!==null){
            element._$dirty=true;
            const fiber={effect:'UPDATE',children:[element],_fibers:[],alternate:null,
                          partial:true,debug:debug};
            updatequeue.push(fiber);
          }
          if(!workLoopActive){
            workLoopActive=true;
            setTimeout(workLoop,0);
          }
        }
        DomElement.prototype._update=render_update;
        function workLoop(deadline=null){
          let shouldYield=false;
          const initialWorkLength=workstack.length;
          const initialUpdateLength=updatequeue.length;
          let friendly=deadline!=null;
          let initial_delay=0;
          try{
            if(!!friendly){
              initial_delay=deadline.timeRemaining();
              while(!shouldYield){
                while(workstack.length>0&&!shouldYield){
                  let unit=workstack.pop();
                  performUnitOfWork(unit);
                  shouldYield=deadline.timeRemaining()<1;
                }
                if(workstack.length==0&&wipRoot){
                  commitRoot();
                }
                if(workstack.length==0&&updatequeue.length>0&&!wipRoot){
                  wipRoot=updatequeue[0];
                  workstack.push(wipRoot);
                  updatequeue.shift();
                }
                shouldYield=deadline.timeRemaining()<1;
              }
            }else{
              while(1){
                while(workstack.length>0){
                  let unit=workstack.pop();
                  performUnitOfWork(unit);
                }
                if(wipRoot){
                  commitRoot();
                }
                if(updatequeue.length>0&&!wipRoot){
                  wipRoot=updatequeue[0];
                  workstack.push(wipRoot);
                  updatequeue.shift();
                }else{
                  break;
                }
              }
            }
          }catch(e){
            console.error("unhandled workloop exception: "+e.message);
          };
          let debug=workstack.length>1||updatequeue.length>1;
          if(!!debug){
            console.warn("workloop failed to finish",initial_delay,":",initialWorkLength,
                          '->',workstack.length,initialUpdateLength,'->',updatequeue.length);
            
            if(!friendly){
              setTimeout(workLoop,50);
            }else{
              requestIdleCallback(workLoop);
            }
          }else{
            workLoopActive=false;
          }
        }
        function performUnitOfWork(fiber){
          if(!fiber.dom&&fiber.effect=='CREATE'){
            fiber.dom=createDomNode(fiber);
          }
          reconcileChildren(fiber);
        }
        function reconcileChildren(parentFiber){
          workCounter+=1;
          const oldParentFiber=parentFiber.alternate;
          if(!!oldParentFiber){
            oldParentFiber.children.forEach(child=>{
                child._delete=true;
              });
          }
          if(parentFiber.debug){
            console.log("do reconcileChildren");
          }
          let prev=parentFiber;
          while(prev.next){
            prev=prev.next;
          }
          let children_out_of_order=false;
          parentFiber.children.forEach((element,index)=>{
              if(!element||!element.type){
                console.error(`${parentFiber.element.props.id}: undefined child element at index ${index} `);
                
                return;
              }
              const oldFiber=element._$fiber;
              element._delete=false;
              const oldIndex=oldFiber?oldFiber.index:index;
              if(parentFiber.partial){
                index=oldIndex;
              }
              let effect;
              if(!!oldFiber){
                if(oldIndex==index&&element._$dirty===false){
                  return;
                }else{
                  effect='UPDATE';
                }
              }else{
                effect='CREATE';
              }
              element._$dirty=false;
              const newFiber={type:element.type,effect:effect,props:{...element.props},
                              children:element.children.slice(),_fibers:[],parent:(parentFiber.partial&&oldFiber)?oldFiber.parent:parentFiber,
                              alternate:oldFiber,dom:oldFiber?oldFiber.dom:null,element:element,
                              index:index,oldIndex:oldIndex,debug:((parentFiber)||{}).debug};
              if(index!==oldIndex){
                children_out_of_order=true;
              }
              if(!newFiber.parent.dom){
                console.error(`element parent is not mounted id: ${element.props.id} effect: ${effect}`);
                
                return;
              }
              if(newFiber.props.style){
                console.warn("unsafe use of inline style: ",newFiber.type,element.props.id,
                                  newFiber.props.style);
              }
              if(typeof(newFiber.props.style)==='object'){
                newFiber.props.style=util.object2style(newFiber.props.style);
              }
              if(Array.isArray(newFiber.props.className)){
                newFiber.props.className=newFiber.props.className.join(' ');
              }
              element._$fiber=newFiber;
              parentFiber._fibers.push(newFiber);
              prev.next=newFiber;
              prev=newFiber;
              workstack.push(newFiber);
            });
          if(children_out_of_order===true){
            const newFiber={type:parentFiber.type,effect:"SORT_CHILDREN",props:parentFiber.props,
                          children:parentFiber.children.slice(),_fibers:[],parent:parentFiber.parent,
                          dom:parentFiber.dom,debug:parentFiber.debug};
            prev.next=newFiber;
            prev=newFiber;
            workstack.push(newFiber);
          }
          if(!!oldParentFiber){
            oldParentFiber.children.forEach(child=>{
                if(child._delete){
                  deletions.push(child._$fiber);
                }
              });
          }
        }
        function commitRoot(){
          deletions_removed=new Set();
          deletions.forEach(removeDomNode);
          if(deletions_removed.size>0){
            deletions_removed.forEach(elem=>{
                requestIdleCallback(elem.elementUnmounted.bind(elem));
              });
          }
          let unit=wipRoot.next;
          let next;
          while(unit){
            commitWork(unit);
            next=unit.next;
            unit.next=null;
            unit=next;
          }
          currentRoot=wipRoot;
          wipRoot=null;
          deletions=[];
        }
        function commitWork(fiber){
          const parentDom=fiber.parent.dom;
          if(!parentDom){
            console.warn(`element has no parent. effect: ${fiber.effect}`);
            return;
          }
          if(((fiber)||{}).debug){
            console.log("commitWork: "+fiber.effect);
          }
          if(fiber.effect==='CREATE'){
            const length=parentDom.children.length;
            const position=fiber.index;
            if(length==position){
              parentDom.appendChild(fiber.dom);
            }else{
              parentDom.insertBefore(fiber.dom,parentDom.children[position]);
            }
            if(fiber.element.elementMounted){
              requestIdleCallback(fiber.element.elementMounted.bind(fiber.element));
              
            }
          }else if(fiber.effect==='UPDATE'){
            fiber.alternate.alternate=null;
            updateDomNode(fiber);
          }else if(fiber.effect==='DELETE'){
            fiber.alternate.alternate=null;
            removeDomNode(fiber);
          }else if(fiber.effect==='SORT_CHILDREN'){
            Array.from(fiber.dom.childNodes).forEach((node,idx)=>{
                let expected_index=node._$fiber.index;
                if(node._$fiber.index!==idx){
                  fiber.dom.removeChild(node);
                  fiber.dom.insertBefore(node,fiber.dom.children[expected_index]);
                  
                }
              });
          }
        }
        const isEvent=key=>key.startsWith("on");
        const isProp=key=>!isEvent(key);
        const isCreate=(prev,next)=>key=>(key in next&&!(key in prev));
        const isUpdate=(prev,next)=>key=>(key in prev&&key in next&&prev[key]!==next[
                    key]);
        const isDelete=(prev,next)=>key=>!(key in next);
        function createDomNode(fiber){
          const dom=fiber.type=="TEXT_ELEMENT"?document.createTextNode(""):document.createElement(
                      fiber.type);
          Object.keys(fiber.props).filter(isEvent).forEach(key=>{
              const event=key.toLowerCase().substring(2);
              dom.addEventListener(event,fiber.props[key]);
            });
          Object.keys(fiber.props).filter(isProp).forEach(key=>{
              const propValue=fiber.props[key];
              if(propValue===null){
                delete dom[key];
              }else{
                dom[key]=propValue;
              }
            });
          dom._$fiber=fiber;
          return dom;
        }
        function updateDomNode(fiber){
          const dom=fiber.dom;
          const parentDom=fiber.parent.dom;
          const oldProps=fiber.alternate.props;
          const newProps=fiber.props;
          if(!dom){
            console.log("fiber does not contain a dom");
            return;
          }
          dom._$fiber=fiber;
          if(fiber.debug){
            console.log("update",fiber.oldIndex,fiber.index);
          }
          if(fiber.oldIndex!=fiber.index&&parentDom){
            if(parentDom.children[fiber.index]!==dom){
              parentDom.removeChild(fiber.dom);
              parentDom.insertBefore(fiber.dom,parentDom.children[fiber.index]);
            }
          }
          Object.keys(oldProps).filter(isEvent).filter(key=>isUpdate(oldProps,newProps)(
                          key)||isDelete(oldProps,newProps)(key)).forEach(key=>{
              const event=key.toLowerCase().substring(2);
              dom.removeEventListener(event,oldProps[key]);
            });
          Object.keys(newProps).filter(isEvent).filter(key=>isCreate(oldProps,newProps)(
                          key)||isUpdate(oldProps,newProps)(key)).forEach(key=>{
              const event=key.toLowerCase().substring(2);
              dom.addEventListener(event,newProps[key]);
            });
          Object.keys(oldProps).filter(isProp).filter(isDelete(oldProps,newProps)).forEach(
                      key=>{
              dom[key]="";
            });
          Object.keys(newProps).filter(isProp).filter(key=>isCreate(oldProps,newProps)(
                          key)||isUpdate(oldProps,newProps)(key)).forEach(key=>{
              dom[key]=newProps[key];
            });
        }
        function _removeDomNode_elementFixUp(element){
          if(element.elementUnmounted){
            deletions_removed.add(element);
          }
          element.children.forEach(child=>{
              child._$fiber=null;
              _removeDomNode_elementFixUp(child);
            });
        }
        function removeDomNode(fiber){
          if(fiber.dom){
            if(fiber.dom.parentNode){
              fiber.dom.parentNode.removeChild(fiber.dom);
            }
          }else{
            console.error("failed to delete",fiber.element.type);
          }
          fiber.dom=null;
          fiber.element._$fiber=null;
          fiber.alternate=null;
          _removeDomNode_elementFixUp(fiber.element);
        }
        return[render,render_update];
      })();
    return{AuthenticatedRouter,ButtonElement,DomElement,DraggableList,DraggableListItem,
          HeaderElement,LinkElement,ListElement,ListItemElement,OSName,Router,StyleSheet,
          TextElement,TextInputElement,build_platform,downloadFile,env,getStyleSheet,
          locationMatch,parseParameters,patternCompile,patternToRegexp,platform,render,
          render_update,uploadFile,util};
  })();
engine=(function(daedalus){
    "use strict";
    const StyleSheet=daedalus.StyleSheet;
    const DomElement=daedalus.DomElement;
    const TextElement=daedalus.TextElement;
    const ListItemElement=daedalus.ListItemElement;
    const ListElement=daedalus.ListElement;
    const HeaderElement=daedalus.HeaderElement;
    const ButtonElement=daedalus.ButtonElement;
    const LinkElement=daedalus.LinkElement;
    const Direction={NONE:0,LEFT:1,RIGHT:2,UP:4,DOWN:8,UPLEFT:5,UPRIGHT:6,DOWNLEFT:9,
          DOWNRIGHT:10};
    Direction.name=Object.fromEntries(Object.entries(Direction).map(([key,value])=>[
                  value,key]));
    Direction.order=[Direction.RIGHT,Direction.UPRIGHT,Direction.UP,Direction.UPLEFT,
          Direction.LEFT,Direction.DOWNLEFT,Direction.DOWN,Direction.DOWNRIGHT];
    Direction.fromVector=function(x,y){
      const theta=Math.atan2(y,-x)*180/Math.PI;
      let index=4+Math.round(theta/45);
      if(index==8){
        index=0;
      }
      return Direction.order[index];
    };
    Direction.vector=function(d){
      let xspeed=0;
      let yspeed=0;
      if(d&Direction.LEFT){
        xspeed=-1;
      }
      if(d&Direction.RIGHT){
        xspeed=1;
      }
      if(d&Direction.UP){
        yspeed=-1;
      }
      if(d&Direction.DOWN){
        yspeed=1;
      }
      return{x:xspeed,y:yspeed};
    };
    class Sound{
      constructor(path){
        let sound=new Audio();
        sound.src=path;
        this.ready=true;
        this.sounds=[sound,sound.cloneNode(),sound.cloneNode()];
        this.index=0;
      }
      play(){
        this.sounds[this.index].play().catch(error=>{
            console.log(error);
          });
        this.index=(this.index+1)%this.sounds.length;
      }
    }
    class Sprite{
      constructor(path){
        this.image=new Image();
        this.ready=false;
        this.image.onload=()=>{
          this.ready=true;
        };
        this.image.src=path;
      }
    }
    class SpriteSheetBuilder{
      constructor(){
        this._path="";
        this._tw=0;
        this._th=0;
        this._rows=0;
        this._cols=0;
        this._xspacing=0;
        this._yspacing=0;
        this._xoffset=0;
        this._yoffset=0;
      }
      path(path){
        this._path=path;
        return this;
      }
      dimensions(tw,th){
        this._tw=tw;
        this._th=th;
        return this;
      }
      layout(rows,cols){
        this._rows=rows;
        this._cols=cols;
        return this;
      }
      offset(x,y){
        this._xoffset=x;
        this._yoffset=y;
        return this;
      }
      spacing(x,y){
        this._xspacing=x;
        this._yspacing=y;
        return this;
      }
      build(){
        console.log([this._path,this._tw,this._th,this._rows,this._cols]);
        let ss=new SpriteSheet(this._path);
        ss.tw=this._tw;
        ss.th=this._th;
        ss.rows=this._rows;
        ss.cols=this._cols;
        ss.xspacing=this._xspacing;
        ss.yspacing=this._yspacing;
        ss.xoffset=this._xoffset;
        ss.yoffset=this._yoffset;
        return ss;
      }
    }
    class SpriteSheet{
      constructor(path){
        this.image=new Image();
        this.ready=false;
        this.image.onload=()=>{
          this.ready=true;
        };
        this.image.src=path;
        this.tw=0;
        this.th=0;
        this.rows=0;
        this.cols=0;
        this.xspacing=0;
        this.yspacing=0;
        this.xoffset=0;
        this.yoffset=0;
      }
      drawTile(ctx,tid,dx,dy){
        dx=Math.floor(dx);
        dy=Math.floor(dy);
        let sx=Math.floor((tid%this.cols)*(this.tw+this.xspacing)+this.xoffset);
        let sy=Math.floor(Math.floor(tid/this.cols)*(this.th+this.yspacing)+this.yoffset);
        
        ctx.drawImage(this.image,sx,sy,this.tw,this.th,dx,dy,this.tw,this.th);
      }
    }
    class Tile{
      constructor(sheet,tid){
        this.sheet=sheet;
        this.tid=tid;
      }
      draw(ctx,dx,dy){
        this.sheet.drawTile(ctx,this.tid,dx,dy);
      }
    }
    class Rect{
      constructor(x,y,w,h){
        this.x=x;
        this.y=y;
        this.w=w;
        this.h=h;
      }
      cx(){
        return Math.floor(this.x+this.w/2);
      }
      cy(){
        return Math.floor(this.y+this.h/2);
      }
      intersect(other){
        let l1=this.x;
        let l2=other.x;
        let r1=this.x+this.w;
        let r2=other.x+other.w;
        let t1=this.y;
        let t2=other.y;
        let b1=this.y+this.h;
        let b2=other.y+other.h;
        let l3=Math.max(l1,l2);
        let r3=Math.min(r1,r2);
        let t3=Math.max(t1,t2);
        let b3=Math.min(b1,b2);
        if(r3>l3&&b3>t3){
          return new Rect(l3,t3,r3-l3,b3-t3);
        }else{
          return new Rect(0,0,0,0);
        }
      }
      collideRect(other){
        let l1=this.x;
        let l2=other.x;
        let r1=this.x+this.w;
        let r2=other.x+other.w;
        let t1=this.y;
        let t2=other.y;
        let b1=this.y+this.h;
        let b2=other.y+other.h;
        return Math.max(l1,l2)<Math.min(r1,r2)&&Math.max(t1,t2)<Math.min(b1,b2);
      }
      collidePoint(x,y){
        let l1=this.x;
        let r1=this.x+this.w;
        let t1=this.y;
        let b1=this.y+this.h;
        return l1<x&&x<r1&&t1<y&&y<b1;
      }
    }
    class Physics2d{
      constructor(target){
        this.target=target;
        this.xspeed=0;
        this.yspeed=0;
        this.ximpulse=0;
        this.yimpulse=0;
        this.group=null;
        this.map_width=640;
        this.map_height=320;
      }
      collidePoint(x,y){
        for(let i=0;i<this.group.length;i++)
        {
          if(this.group[i].rect.collidePoint(x,y)){
            return this.group[i];
          }
        }
        return null;
      }
      impulse(dx,dy){
        this.ximpulse=dx;
        this.yimpulse=dy;
      }
      update(dt){
        let rect,solid;
        let dx,dy;
        if(this.ximpulse!=0||this.yimpulse!=0){
          dx=dt*this.ximpulse;
          dy=dt*this.yimpulse;
          this.ximpulse*=.95;
          this.yimpulse*=.95;
          if(Math.abs(this.ximpulse)<30){
            this.ximpulse=0;
          }
          if(Math.abs(this.yimpulse)<30){
            this.yimpulse=0;
          }
        }else{
          dx=dt*this.xspeed;
          dy=dt*this.yspeed;
        }
        rect=new Rect(this.target.rect.x+dx,this.target.rect.y,this.target.rect.w,
                  this.target.rect.h);
        solid=false;
        for(let i=0;i<this.group.length;i++)
        {
          if(rect.collideRect(this.group[i].rect)){
            solid=true;
            break;
          }
        }
        if(!solid){
          this.target.rect=rect;
        }
        rect=new Rect(this.target.rect.x,this.target.rect.y+dy,this.target.rect.w,
                  this.target.rect.h);
        solid=false;
        for(let i=0;i<this.group.length;i++)
        {
          if(rect.collideRect(this.group[i].rect)){
            solid=true;
            break;
          }
        }
        if(!solid){
          this.target.rect=rect;
        }
      }
    }
    class Animation{
      constructor(target){
        this.target=target;
        this.next_id=0;
        this.animations={};
        this.animation=null;
        this.timer=0;
        this.frame_index=0;
        this.aid=-1;
        this.paused=0;
        this.effect=null;
      }
      register(sheet,tids,frame_duration,params){
        let aid=this.next_id;
        let obj={sheet,tids,frame_duration,xoffset:params.xoffset??0,yoffset:params.yoffset??0,
                  loop:params.loop??true,onend:params.onend??null};
        this.animations[aid]=obj;
        this.next_id+=1;
        return aid;
      }
      setAnimationById(aid){
        if(aid!=this.aid){
          this.timer=0;
          this.frame_index=0;
          this.animation=this.animations[aid];
          this.aid=aid;
        }
        this.paused=0;
      }
      pause(){
        this.paused=1;
        this.frame_index=0;
      }
      update(dt){
        if(this.animation&&this.paused===0){
          this.timer+=dt;
          if(this.timer>this.animation.frame_duration){
            this.timer-=this.animation.frame_duration;
            this.frame_index+=1;
            if(this.frame_index>=this.animation.tids.length){
              ((this.animation.onend)||(()=>null))();
              if(this.animation.loop){
                this.frame_index=0;
              }else{
                this.paused=1;
              }
            }
          }
        }
      }
      paint(ctx){
        if(this.animation){
          let tid=this.animation.tids[this.frame_index];
          let x=this.target.rect.x+this.animation.xoffset;
          let y=this.target.rect.y+this.animation.yoffset;
          ctx.save();
          ((this.effect)||(()=>null))(ctx);
          this.animation.sheet.drawTile(ctx,tid,x,y);
          ctx.restore();
        }
      }
    }
    class CharacterComponent{
      constructor(target){
        this.target=target;
        this.alive=true;
        this.health=3;
        this.hurt_timer=0;
        this.hurt_period=.5;
      }
      update(dt){
        if(this.hurt_timer>0){
          this.hurt_timer-=dt;
          if(this.hurt_timer<0&&this.health<=0){
            this.alive=false;
          }
        }
      }
      hit(power,direction){
        this.hurt_timer=this.hurt_period;
        this.health-=power;
        if(direction>0){
          let vector=Direction.vector(direction);
          this.target.physics.impulse(vector.x*100,vector.y*100);
        }
        this.target.animation.effect=(ctx)=>{
          if(this.hurt_timer<=0){
            this.target.animation.effect=null;
          }
          let x;
          x=(this.hurt_timer>this.hurt_period/2)?this.hurt_period-this.hurt_timer:this.hurt_timer;
          
          x=Math.floor(100+200*x);
          ctx.filter=`brightness(${x}%) hue-rotate(-90deg)`;
        };
        this.target.sound_hit.play();
      }
    }
    class Entity{
      constructor(){
        this.sprite=null;
        this.rect=new Rect(0,0,0,0);
        this.physics=new Physics2d(this);
        this.animation=new Animation(this);
      }
      update(dt){
        this.physics.update(dt);
        this.animation.update(dt);
      }
      paint(ctx){
        if(this.sprite&&this.sprite.ready){
          ctx.drawImage(this.sprite.image,this.rect.x,this.rect.y);
        }
        this.animation.paint(ctx);
      }
    }
    const Keys={LEFT:37,UP:38,RIGHT:39,DOWN:40,SPACE:32,SHIFT:16,CTRL:17,ALT:18};
    
    class KeyboardInput{
      constructor(target){
        this.target=target;
        this.keysDown=[];
        this.buttons=[Keys.CTRL,Keys.SPACE];
      }
      handlePress(kc){
        if(kc>=37&&kc<=40){
          if(!this.keysDown.includes(kc)){
            this.keysDown.push(kc);
          }
          this.target.setInputDirection(this.getDirection(this.keysDown));
        }else{
          let match=0;
          for(let i=0;i<this.buttons.length;i++)
          {
            if(this.buttons[i]==kc){
              this.target.handleButtonPress(i);
              match=1;
            }
          }
          if(match===0){
            console.log(`unexpected keycode ${event.keyCode}`);
          }
        }
      }
      handleRelease(kc){
        if(kc>=37&&kc<=40){
          var index=this.keysDown.indexOf(kc);
          if(index!==-1){
            this.keysDown.splice(index,1);
          }
          this.target.setInputDirection(this.getDirection(this.keysDown));
        }else{
          let match=0;
          for(let i=0;i<this.buttons.length;i++)
          {
            if(this.buttons[i]==kc){
              this.target.handleButtonRelease(i);
              match=1;
            }
          }
          if(match===0){
            console.log(`unexpected keycode ${event.keyCode}`);
          }
        }
      }
      getDirection(keysDown){
        let h=0;
        let v=0;
        for(let i=0;i<keysDown.length;i++)
        {
          const kc=keysDown[i];
          if(h==0&&kc==Keys.LEFT){
            h=Direction.LEFT;
          }
          if(h==0&&kc==Keys.RIGHT){
            h=Direction.RIGHT;
          }
          if(v==0&&kc==Keys.UP){
            v=Direction.UP;
          }
          if(v==0&&kc==Keys.DOWN){
            v=Direction.DOWN;
          }
        }
        return h|v;
      }
    }
    class TouchInput{
      constructor(target){
        this.target=target;
        this.ce=160;
        this.cx=64;
        this.cy=256;
        this.touch_at=[0,0];
        this.touch_move=null;
        this.buttons=[{cx:576,cy:224,radius:32,pressed:0},{cx:512,cy:288,radius:32,
                      pressed:0}];
        console.log(this.buttons);
      }
      handleMove(tx,ty){
        const e=this.ce;
        const cx=this.cx;
        const cy=this.cy;
        const d=Direction.fromVector(tx-cx,ty-cy);
        this.target.setInputDirection(d);
        this.touch_at=[tx,ty];
      }
      handleMoveCancel(){
        this.target.setInputDirection(0);
      }
      handleButtonPress(btnid){
        this.target.handleButtonPress(btnid);
      }
      handleButtonRelease(btnid){
        this.target.handleButtonRelease(btnid);
      }
      handleTouches(touches){
        for(let j=0;j<this.buttons.length;j++)
        {
          let btn=this.buttons[j];
          let pressed=0;
          for(let i=touches.length-1;i>=0;i--)
          {
            let touch=touches[i];
            const dx=btn.cx-touch.x;
            const dy=btn.cy-touch.y;
            if((dx*dx+dy*dy)<btn.radius*btn.radius){
              pressed=1;
              touches.splice(i,1);
            }
          }
          if(pressed&&!btn.pressed){
            btn.pressed=1;
            this.handleButtonPress(j);
          }else if(!pressed&&btn.pressed){
            btn.pressed=0;
            this.handleButtonRelease(j);
          }
        }
        let touch_move=null;
        for(let i=0;i<touches.length;i++)
        {
          let touch=touches[i];
          if(touch.x<320){
            touch_move=touch;
            break;
          }
        }
        if(touch_move===null&&this.touch_move!==null){
          this.touch_move=null;
          this.handleMoveCancel();
        }else if(touch_move){
          this.touch_move=touch_move;
          this.handleMove(touch_move.x,touch_move.y);
        }
      }
      paint(ctx){
        ctx.lineWidth=2;
        ctx.strokeStyle='red';
        ctx.beginPath();
        const e=this.ce;
        const e2=Math.floor(this.ce/2);
        const e3=Math.floor(this.ce/2*.7071);
        const cx=Math.floor(this.cx);
        const cy=Math.floor(this.cy);
        ctx.moveTo(0,0);
        ctx.moveTo(cx-e3,cy-e3);
        ctx.lineTo(cx+e3,cy+e3);
        ctx.moveTo(cx+e3,cy-e3);
        ctx.lineTo(cx-e3,cy+e3);
        ctx.moveTo(cx-e2,cy);
        ctx.lineTo(cx+e2,cy);
        ctx.moveTo(cx,cy-e2);
        ctx.lineTo(cx,cy+e2);
        ctx.moveTo(cx,cy);
        ctx.arc(cx,cy,e2,0,2*Math.PI);
        ctx.stroke();
        for(let i=0;i<this.buttons.length;i++)
        {
          ctx.beginPath();
          let btn=this.buttons[i];
          ctx.arc(btn.cx,btn.cy,btn.radius,0,2*Math.PI);
          ctx.stroke();
        }
        let tx=this.touch_at[0],ty=this.touch_at[1];
        ctx.beginPath();
        ctx.arc(tx,ty,5,0,2*Math.PI);
        ctx.stroke();
      }
    }
    class GameScene{
      update(dt){

      }
      paint(ctx){

      }
      resize(){

      }
    }
    const style={"canvas":'dcs-7566c05b-0'};
    class CanvasEngine extends DomElement {
      constructor(width,height){
        super("canvas",{"width":width,"height":height,className:style.canvas});
        this.scene=null;
        this.ctx=null;
        this.lastTime=null;
        this.delta_accum=0;
        this.view={x:0,y:0,width:640,height:320,rotate:0,scale:1};
      }
      elementMounted(){
        this.ctx=this.getDomNode().getContext("2d");
        console.log(`set context ${this.ctx}`);
        this.handleResize(this.props.width,this.props.height);
        window.requestAnimationFrame(this.render.bind(this));
      }
      _getMouseToches(event){
        event.preventDefault();
        const rect=this.getDomNode().getBoundingClientRect();
        const x=(event.clientX-rect.left)/this.view.scale-this.view.x;
        const y=(event.clientY-rect.top)/this.view.scale-this.view.y;
        return[{x,y}];
      }
      onMouseDown(event){
        if(event.buttons&1){
          const touches=this._getMouseToches(event);
          this.scene.touch.handleTouches(touches);
        }
      }
      onMouseMove(event){
        event.preventDefault();
        if(event.buttons&1){
          const touches=this._getMouseToches(event);
          this.scene.touch.handleTouches(touches);
        }
      }
      onMouseUp(event){
        event.preventDefault();
        this.scene.touch.handleTouches([]);
      }
      _getTouches(event){
        event.preventDefault();
        const rect=this.getDomNode().getBoundingClientRect();
        return Array.from(event.targetTouches).map(touch=>{
            if(this.view.rotate){
              return{"x":(touch.clientY-rect.top-this.view.y),"y":this.view.height-(
                                  touch.clientX-rect.left-this.view.x)};
            }else{
              return{"x":(touch.clientX-rect.left-this.view.x),"y":(touch.clientY-rect.top-this.view.y)};
              
            }
          });
      }
      onTouchStart(event){
        const touches=this._getTouches(event);
        this.scene.touch.handleTouches(touches);
      }
      onTouchMove(event){
        const touches=this._getTouches(event);
        this.scene.touch.handleTouches(touches);
      }
      onTouchEnd(event){
        const touches=this._getTouches(event);
        this.scene.touch.handleTouches(touches);
      }
      handleResize(width,height){
        this.view.x=32;
        this.view.y=32;
        if(width/height<0.75){
          this.view.rotate=1;
        }else{
          this.view.rotate=0;
        }
        this.view.scale=1;
        if(this.view.rotate){
          if(height>2*this.view.width&&width>2*this.view.height){
            this.view.scale=2;
          }
        }else{
          if(width>2*this.view.width&&height>2*this.view.height){
            this.view.scale=2;
          }
        }
        if(!daedalus.platform.isMobile&&!this.view.rotate){
          this.view.x=Math.floor((width-(this.view.width*this.view.scale))/(2*this.view.scale));
          
        }
        console.log('view',width/height,width,height,this.view);
      }
      handleKeyPress(event){
        const kc=event.keyCode;
        if(kc<112){
          this.scene.keyboard.handlePress(kc);
          event.preventDefault();
        }
      }
      handleKeyRelease(event){
        const kc=event.keyCode;
        if(kc<112){
          this.scene.keyboard.handleRelease(kc);
          event.preventDefault();
        }
      }
      renderFrame(){
        const ctx=this.ctx;
        if(ctx===null){
          console.log(ctx);
          return;
        }
        ctx.resetTransform();
        ctx.clearRect(0,0,this.props.width,this.props.height);
        ctx.scale(this.view.scale,this.view.scale);
        if(this.view.rotate){
          ctx.rotate((90*Math.PI)/180);
          ctx.translate(0,-this.props.width/this.view.scale);
        }
        ctx.translate(this.view.x,this.view.y);
        ctx.webkitImageSmoothingEnabled=false;
        ctx.mozImageSmoothingEnabled=false;
        ctx.imageSmoothingEnabled=false;
        this.scene.paint(ctx);
      }
      render(){
        var now=performance.now();
        if(this.lastTime!=null){
          this.delta_accum+=(now-this.lastTime)/1000.0;
          let dt=0.016666666666666666;
          let n=0;
          while(this.delta_accum>dt){
            this.delta_accum-=dt;
            this.scene.update(dt);
            n+=1;
          }
          if(n>0){
            this.renderFrame();
          }
          this.fps=Math.floor(1.0/dt);
        }
        this.lastTime=now;
        window.requestAnimationFrame(this.render.bind(this));
      }
    }
    return{Animation,CanvasEngine,CharacterComponent,Direction,Entity,GameScene,KeyboardInput,
          Physics2d,Rect,Sound,Sprite,SpriteSheet,SpriteSheetBuilder,Tile,TouchInput};
    
  })(daedalus);
scenes=(function(engine){
    "use strict";
    const Sound=engine.Sound;
    const Sprite=engine.Sprite;
    const SpriteSheetBuilder=engine.SpriteSheetBuilder;
    const SpriteSheet=engine.SpriteSheet;
    const Direction=engine.Direction;
    const TouchInput=engine.TouchInput;
    const KeyboardInput=engine.KeyboardInput;
    const Rect=engine.Rect;
    const Entity=engine.Entity;
    const CharacterComponent=engine.CharacterComponent;
    const GameScene=engine.GameScene;
    function randomNumber(min,max){
      return Math.round(Math.random()*(max-min)+min);
    }
    class Camera{
      constructor(target){
        this.target=target;
        this.x=0;
        this.y=0;
      }
      update(dt){
        this.x=Math.floor(this.target.rect.cx()-gEngine.view.width/2);
        this.y=Math.floor(this.target.rect.cy()-gEngine.view.height/2);
      }
    }
    class Controller{
      constructor(scene,target){
        this.scene=scene;
        this.target=target;
        this.direction=0;
      }
      setInputDirection(d){
        this.direction=d;
        this.target.setDirection(this.direction);
      }
      handleButtonPress(btnid){
        console.log("press",btnid);
        if(btnid===0){
          let bomb=new Bomb(this.scene.tiles_bomb);
          bomb.sound_bomb_bang=this.scene.sound_bomb_bang;
          bomb.physics.group=this.scene.walls;
          bomb.rect.x=this.scene.ent_hero.rect.x;
          bomb.rect.y=this.scene.ent_hero.rect.y;
          bomb.rect.w=16;
          bomb.rect.h=16;
          bomb.targets=[this.scene.ent_hero,...this.scene.npcs];
          this.scene.bombs.push(bomb);
          this.scene.sound_bomb_drop.play();
        }else if(btnid===1){
          this.target.attack();
        }
      }
      handleButtonRelease(btnid){
        console.log("release",btnid);
      }
      update(dt){
        let speed=128;
        let v=Direction.vector(this.direction);
        this.target.physics.xspeed=speed*v.x;
        this.target.physics.yspeed=speed*v.y;
      }
    }
    class Wall extends Entity {
      constructor(sheet){
        super();
        this.sheet=sheet;
        this.breakable=0;
        this.alive=1;
      }
      paint(ctx){
        let l=this.rect.x;
        let t=this.rect.y;
        let r=this.rect.x+this.rect.w;
        let b=this.rect.y+this.rect.h;
        for(let x=l;x<r;x+=32)
        {
          for(let y=t;y<b;y+=32)
          {
            this.sheet.drawTile(ctx,this.breakable?2:1,x,y);
          }
        }
      }
    }
    class Hero extends Entity {
      constructor(){
        super();
        this.direction=Direction.DOWN;
        this.attacking=0;
        this.attacking_tid=0;
        this.attacking_info=null;
        this.mobs=[];
        this.character=new CharacterComponent(this);
      }
      setDirection(d){
        if(!this.attacking){
          if(d>0){
            this.animation.setAnimationById(this.d2a[d]);
          }else{
            this.animation.pause();
          }
        }
        if(d>0){
          this.direction=d;
        }
      }
      attack(){
        if(this.attacking==0){
          this.attacking=1;
          this.attacking_info=this.d2a_atk_tid[this.direction];
          this.animation.setAnimationById(this.d2a_atk[this.direction]);
          let rect=new Rect(this.rect.x+this.attacking_info.rx,this.rect.y+this.attacking_info.ry,
                      this.attacking_info.w,this.attacking_info.h);
          this.attacking_info.rect=rect;
          for(let i=0;i<this.mobs.length;i++)
          {
            if(rect.collideRect(this.mobs[i].rect)){
              this.mobs[i].character.hit(1,this.direction);
            }
          }
          this.sound_sword.play();
        }
      }
      handleAttackEnd(){
        this.attacking=0;
        this.animation.setAnimationById(this.d2a[this.direction]);
        this.attacking_info=null;
        if(this.physics.xspeed===0&&this.physics.yspeed===0){
          this.animation.pause();
        }
      }
      setSpriteSheet(sheet){
        this.sheet=sheet;
        let aidd=this.animation.register(sheet,[0,1],.15,{xoffset:-8,yoffset:-16});
        
        let aidu=this.animation.register(sheet,[4,5],.15,{xoffset:-8,yoffset:-16});
        
        let aidl=this.animation.register(sheet,[8,9],.15,{xoffset:-8,yoffset:-16});
        
        let aidr=this.animation.register(sheet,[12,13],.15,{xoffset:-8,yoffset:-16});
        
        let aidd_atk=this.animation.register(sheet,[2],.4,{xoffset:-8,yoffset:-16,
                      loop:false,onend:this.handleAttackEnd.bind(this)});
        let aidu_atk=this.animation.register(sheet,[6],.4,{xoffset:-8,yoffset:-16,
                      loop:false,onend:this.handleAttackEnd.bind(this)});
        let aidl_atk=this.animation.register(sheet,[10],.4,{xoffset:-8,yoffset:-16,
                      loop:false,onend:this.handleAttackEnd.bind(this)});
        let aidr_atk=this.animation.register(sheet,[14],.4,{xoffset:-8,yoffset:-16,
                      loop:false,onend:this.handleAttackEnd.bind(this)});
        this.d2a={[Direction.UP]:aidu,[Direction.UPRIGHT]:aidu,[Direction.RIGHT]:aidr,
                  [Direction.DOWNRIGHT]:aidd,[Direction.DOWN]:aidd,[Direction.DOWNLEFT]:aidd,
                  [Direction.LEFT]:aidl,[Direction.UPLEFT]:aidu};
        this.d2a_atk={[Direction.UP]:aidu_atk,[Direction.UPRIGHT]:aidu_atk,[Direction.RIGHT]:aidr_atk,
                  [Direction.DOWNRIGHT]:aidd_atk,[Direction.DOWN]:aidd_atk,[Direction.DOWNLEFT]:aidd_atk,
                  [Direction.LEFT]:aidl_atk,[Direction.UPLEFT]:aidu_atk};
        let sw=20;
        let sh=16;
        let so=(32-sh)/2;
        this.d2a_atk_tid={[Direction.UP]:{tid:7,x:-8+0,y:-16+-32,rx:-8+so,ry:-16+-sw,
                      w:sh,h:sw},[Direction.UPRIGHT]:{tid:7,x:-8+0,y:-16+-32,rx:-8+so,ry:-16+-sw,
                      w:sh,h:sw},[Direction.RIGHT]:{tid:15,x:-8+32,y:-16+0,rx:-8+32,ry:-16+so,
                      w:sw,h:sh},[Direction.DOWNRIGHT]:{tid:3,x:-8+0,y:-16+32,rx:-8+so,ry:-16+32,
                      w:sh,h:sw},[Direction.DOWN]:{tid:3,x:-8+0,y:-16+32,rx:-8+so,ry:-16+32,
                      w:sh,h:sw},[Direction.DOWNLEFT]:{tid:3,x:-8+0,y:-16+32,rx:-8+so,ry:-16+32,
                      w:sh,h:sw},[Direction.LEFT]:{tid:11,x:-8+-32,y:-16+0,rx:-8+-sw,ry:-16+so,
                      w:sw,h:sh},[Direction.UPLEFT]:{tid:7,x:-8+0,y:-16+-32,rx:-8+so,ry:-16+-sw,
                      w:sh,h:sw}};
        this.animation.setAnimationById(aidd);
        this.animation.pause();
        this.current_aid=aidd;
      }
      update(dt){
        if(!this.attacking){
          this.physics.update(dt);
        }
        this.animation.update(dt);
        this.character.update(dt);
      }
      paint(ctx){
        this.animation.paint(ctx);
        if(this.attacking){
          let obj=this.attacking_info;
          this.sheet.drawTile(ctx,obj.tid,this.rect.x+obj.x,this.rect.y+obj.y);
        }
      }
    }
    class Monster extends Entity {
      constructor(sheet){
        super();
        let aidd=this.animation.register(sheet,[0],.15,{xoffset:-8,yoffset:-16});
        
        this.animation.setAnimationById(aidd);
        this.character=new CharacterComponent(this);
        this.rect.w=16;
        this.rect.h=16;
      }
      update(dt){
        this.physics.update(dt);
        this.character.update(dt);
        this.animation.update(dt);
      }
      paint(ctx){
        this.animation.paint(ctx);
      }
    }
    class Bomb extends Entity {
      constructor(sheet){
        super(null);
        this.sheet=sheet;
        this.alive=1;
        this.timer_max=1.5;
        this.timer=this.timer_max;
        this.bounds_check=true;
        this.bounds={l:0,r:0,t:0,b:0};
        this.target_blocks=null;
        this.sound_played=false;
        this.mob_checked=false;
      }
      update(dt){
        this.timer-=dt;
        if(this.bounds_check&&this.timer<1.2){
          this.bounds_check=false;
          let cx=this.rect.x+this.rect.w/2;
          let cy=this.rect.y+this.rect.h/2;
          let blocks=new Set();
          for(let i=1;i<4;i++)
          {
            let obj=this.physics.collidePoint(cx-i*16,cy);
            if(obj&&obj.breakable){
              blocks.add(obj);
            }else if(obj){
              break;
            }
            this.bounds.l=i;
          }
          for(let i=1;i<4;i++)
          {
            let obj=this.physics.collidePoint(cx,cy-i*16);
            if(obj&&obj.breakable){
              blocks.add(obj);
            }else if(obj){
              break;
            }
            this.bounds.t=i;
          }
          for(let i=1;i<4;i++)
          {
            let obj=this.physics.collidePoint(cx+i*16,cy);
            if(obj&&obj.breakable){
              blocks.add(obj);
            }else if(obj){
              break;
            }
            this.bounds.r=i;
          }
          for(let i=1;i<4;i++)
          {
            let obj=this.physics.collidePoint(cx,cy+i*16);
            if(obj&&obj.breakable){
              blocks.add(obj);
            }else if(obj){
              break;
            }
            this.bounds.b=i;
          }
          this.target_blocks=blocks;
        }
        if(this.timer<1&&!this.sound_played){
          this.sound_bomb_bang.play();
          this.sound_played=true;
        }
        if(!this.mob_checked&&this.timer<.6){
          let cx=this.rect.x+this.rect.w/2;
          let cy=this.rect.y+this.rect.h/2;
          let rhl=16*this.bounds.l;
          let rht=16*this.bounds.t;
          let rhr=16*this.bounds.r;
          let rhb=16*this.bounds.b;
          let rw=6;
          let rect1=new Rect(cx-rhl,cy-rw,(cx+rhr)-(cx-rhl),rw*2);
          let rect2=new Rect(cx-rw,cy-rht,rw*2,(cy+rhb)-(cy-rht));
          for(let i=0;i<this.targets.length;i++)
          {
            let chara=this.targets[i];
            if(chara.rect.collideRect(rect1)||chara.rect.collideRect(rect2)){
              chara.character.hit(3,Direction.NONE);
            }
          }
          console.log(this.targets);
          this.mob_checked=true;
        }
        if(this.target_blocks&&this.timer<.6){
          this.target_blocks.forEach(item=>item.alive=0);
          this.target_blocks=null;
        }
        if(this.timer<0){
          this.alive=0;
        }
      }
      paint(ctx){
        if(this.timer>1.0){
          let x=1-this.timer%1;
          let n=this.timer_max-Math.floor(this.timer);
          let p=1.0;
          let m=1.0+.4*Math.sin(2*Math.PI*x*n/p);
          ctx.save();
          ctx.filter=`brightness(${Math.floor(m*100)}%)`;
          this.sheet.drawTile(ctx,1,this.rect.x,this.rect.y);
          ctx.restore();
        }else if(this.timer>0){
          let x;
          let cx,cy,cr;
          let rw,rh;
          ctx.save();
          if(this.timer>0.25){
            x=(1-this.timer)/.75;
            cx=this.rect.x+this.rect.w/2;
            cy=this.rect.y+this.rect.h/2;
            cr=14*(0.5+x/2);
            rw=6*x;
            let rhl=16*this.bounds.l*x;
            let rht=16*this.bounds.t*x;
            let rhr=16*this.bounds.r*x;
            let rhb=16*this.bounds.b*x;
            ctx.fillStyle=`rgb(255, ${127+128*x}, ${255*x})`;
            ctx.beginPath();
            ctx.arc(cx,cy,cr,0,2*Math.PI);
            ctx.roundRect(cx-rhl,cy-rw,rhl,2*rw,rw);
            ctx.roundRect(cx-rw,cy-rht,2*rw,rht,rw);
            ctx.roundRect(cx,cy-rw,rhr,2*rw,rw);
            ctx.roundRect(cx-rw,cy,2*rw,rhb,rw);
            ctx.fill();
            cr=9*(0.5+x/2);
            rw=3*x;
            ctx.fillStyle=`rgb(255, ${191+64*x}, ${255*x})`;
            ctx.beginPath();
            ctx.arc(cx,cy,cr,0,2*Math.PI);
            ctx.roundRect(cx-rhl,cy-rw,rhl,2*rw,rw);
            ctx.roundRect(cx-rw,cy-rht,2*rw,rht,rw);
            ctx.roundRect(cx,cy-rw,rhr,2*rw,rw);
            ctx.roundRect(cx-rw,cy,2*rw,rhb,rw);
            ctx.fill();
          }else{
            x=.75*(this.timer/.25);
            cx=this.rect.x+this.rect.w/2;
            cy=this.rect.y+this.rect.h/2;
            cr=14*(0.3+2*x/3);
            rw=6*x;
            let rhl=16*this.bounds.l;
            let rht=16*this.bounds.t;
            let rhr=16*this.bounds.r;
            let rhb=16*this.bounds.b;
            ctx.fillStyle="#FFFFFF";
            ctx.beginPath();
            ctx.arc(cx,cy,cr,0,2*Math.PI);
            ctx.roundRect(cx-rhl,cy-rw,rhl,2*rw,rw);
            ctx.roundRect(cx-rw,cy-rht,2*rw,rht,rw);
            ctx.roundRect(cx,cy-rw,rhr,2*rw,rw);
            ctx.roundRect(cx-rw,cy,2*rw,rhb,rw);
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }
    class MainScene extends GameScene {
      constructor(){
        super();
        this.sound_hit=new Sound("/static/sound/LOZ_Enemy_Hit.wav");
        this.sound_sword=new Sound("/static/sound/LOZ_Sword_Slash.wav");
        this.sound_bomb_drop=new Sound("/static/sound/LOZ_Bomb_Drop.wav");
        this.sound_bomb_bang=new Sound("/static/sound/LOZ_Bomb_Blow.wav");
        this.tiles_bg=new SpriteSheetBuilder().path("/static/tile2.png").dimensions(
                  32,32).layout(1,4).build();
        this.tiles_bomb=new SpriteSheetBuilder().path("/static/bomb.png").dimensions(
                  16,16).layout(1,2).build();
        this.tiles_hero=new SpriteSheetBuilder().path("/static/char32.png").dimensions(
                  32,32).layout(4,4).offset(1,1).spacing(1,1).build();
        this.tiles_monster=new SpriteSheetBuilder().path("/static/monster32.png").dimensions(
                  32,32).layout(4,4).offset(1,1).spacing(1,1).build();
        this.ent_hero=new Hero();
        this.ent_hero.setSpriteSheet(this.tiles_hero);
        this.ent_hero.sound_sword=this.sound_sword;
        this.ent_hero.sound_hit=this.sound_hit;
        this.ent_monster=new Monster(this.tiles_monster);
        this.ent_monster.sound_hit=this.sound_hit;
        this.bombs=[];
        this.map={width:960,height:960};
        this.walls=[];
        let wall;
        wall=new Wall(this.tiles_bg);
        wall.rect=new Rect(0,0,this.map.width,32);
        this.walls.push(wall);
        wall=new Wall(this.tiles_bg);
        wall.rect=new Rect(0,32,32,this.map.height-64);
        this.walls.push(wall);
        wall=new Wall(this.tiles_bg);
        wall.rect=new Rect(this.map.width-32,32,32,this.map.height-64);
        this.walls.push(wall);
        wall=new Wall(this.tiles_bg);
        wall.rect=new Rect(0,this.map.height-32,this.map.width,32);
        this.walls.push(wall);
        for(let i=128;i<this.map.height-32;i+=128)
        {
          wall=new Wall(this.tiles_bg);
          wall.rect=new Rect(32,i,64,32);
          this.walls.push(wall);
        }
        wall=new Wall(this.tiles_bg);
        wall.breakable=1;
        wall.rect=new Rect(192,96,96,32);
        this.walls.push(wall);
        wall=new Wall(this.tiles_bg);
        wall.breakable=1;
        wall.rect=new Rect(192,192,96,32);
        this.walls.push(wall);
        wall=new Wall(this.tiles_bg);
        wall.breakable=1;
        wall.rect=new Rect(352,96,96,32);
        this.walls.push(wall);
        wall=new Wall(this.tiles_bg);
        wall.breakable=1;
        wall.rect=new Rect(352,192,96,32);
        this.walls.push(wall);
        wall=new Wall(this.tiles_bg);
        wall.breakable=1;
        wall.rect=new Rect(128,64,64,32);
        this.walls.push(wall);
        wall=new Wall(this.tiles_bg);
        wall.breakable=1;
        wall.rect=new Rect(128,224,64,32);
        this.walls.push(wall);
        wall=new Wall(this.tiles_bg);
        wall.breakable=1;
        wall.rect=new Rect(448,64,64,32);
        this.walls.push(wall);
        wall=new Wall(this.tiles_bg);
        wall.breakable=1;
        wall.rect=new Rect(448,224,64,32);
        this.walls.push(wall);
        this.ent_hero.physics.group=this.walls;
        this.ent_monster.physics.group=this.walls;
        this.npcs=[this.ent_monster];
        this.ent_hero.mobs=this.npcs;
        this.controller=new Controller(this,this.ent_hero);
        this.camera=new Camera(this.ent_hero);
        gEngine.view.width=320;
        gEngine.view.height=320;
        this.ent_hero.rect.x=64;
        this.ent_hero.rect.y=64;
        this.ent_hero.rect.w=16;
        this.ent_hero.rect.h=16;
        this.ent_monster.rect.x=72;
        this.ent_monster.rect.y=144;
        this.touch=new TouchInput(this.controller);
        this.keyboard=new KeyboardInput(this.controller);
      }
      moveMonster(npc){
        let x=Math.floor(randomNumber(1,18)*32);
        let y=Math.floor(randomNumber(1,8)*32);
        while(npc.physics.collidePoint(x+16,y+16)){
          x=Math.floor(randomNumber(1,18)*32);
          y=Math.floor(randomNumber(1,8)*32);
        }
        npc.rect.x=x+8;
        npc.rect.y=y+16;
      }
      update(dt){
        this.controller.update(dt);
        this.ent_hero.update(dt);
        for(let i=this.npcs.length-1;i>=0;i--)
        {
          let npc=this.npcs[i];
          npc.update(dt);
          if(!npc.character.alive){
            npc.character.health=3;
            npc.character.alive=true;
            this.moveMonster(npc);
          }
        }
        for(let i=this.walls.length-1;i>=0;i--)
        {
          if(!this.walls[i].alive){
            this.walls.splice(i,1);
          }
        }
        for(let i=this.bombs.length-1;i>=0;i--)
        {
          this.bombs[i].update(dt);
          if(!this.bombs[i].alive){
            this.bombs.splice(i,1);
          }
        }
        this.camera.update(dt);
      }
      paint_map(ctx){
        if(this.tiles_bg.ready){
          for(let x=0;x<this.map.width;x+=32)
          {
            for(let y=0;y<this.map.height;y+=32)
            {
              this.tiles_bg.drawTile(ctx,0,x,y);
            }
          }
        }
        for(let i=0;i<this.walls.length;i++)
        {
          this.walls[i].paint(ctx);
        }
        for(let i=0;i<this.bombs.length;i++)
        {
          this.bombs[i].paint(ctx);
        }
        for(let i=0;i<this.npcs.length;i++)
        {
          this.npcs[i].paint(ctx);
        }
        this.ent_hero.paint(ctx);
      }
      paint(ctx){
        ctx.fillStyle="yellow";
        ctx.fillText(`fps = ${this.fps} direction = ${Direction.name[this.controller.direction]}`,
                  0,-8);
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle='red';
        ctx.rect(-1,-1,gEngine.view.width+2,gEngine.view.height+2);
        ctx.moveTo(0,0);
        ctx.lineTo(gEngine.view.width,gEngine.view.height);
        ctx.moveTo(gEngine.view.width,0);
        ctx.lineTo(0,gEngine.view.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(0,0,gEngine.view.width,gEngine.view.height);
        ctx.clip();
        ctx.translate(-this.camera.x,-this.camera.y);
        this.paint_map(ctx);
        ctx.restore();
        this.touch.paint(ctx);
      }
      resize(){

      }
      o
    }
    return{MainScene};
  })(engine);
app=(function(daedalus,engine,scenes){
    "use strict";
    const StyleSheet=daedalus.StyleSheet;
    const DomElement=daedalus.DomElement;
    const TextElement=daedalus.TextElement;
    const ListItemElement=daedalus.ListItemElement;
    const ListElement=daedalus.ListElement;
    const HeaderElement=daedalus.HeaderElement;
    const ButtonElement=daedalus.ButtonElement;
    const LinkElement=daedalus.LinkElement;
    const CanvasEngine=engine.CanvasEngine;
    const MainScene=scenes.MainScene;
    const style={"body":'dcs-2fe07cda-0',"bodyRotate":'dcs-2fe07cda-1',"main":'dcs-2fe07cda-2',
          "item_hover":'dcs-2fe07cda-3',"item":'dcs-2fe07cda-4',"item_file":'dcs-2fe07cda-5'};
    
    class Application extends DomElement {
      constructor(){
        super("div",{className:style.main},[]);
        const body=document.getElementsByTagName("BODY")[0];
        body.className=style.body;
        console.log("build app");
      }
      elementMounted(){
        this.canvas=this.appendChild(new CanvasEngine(window.innerWidth,window.innerHeight));
        
        window.gEngine=this.canvas;
        this.canvas.scene=new MainScene();
        console.log("scene created");
        window.addEventListener("keydown",this.canvas.handleKeyPress.bind(this.canvas));
        
        window.addEventListener("keyup",this.canvas.handleKeyRelease.bind(this.canvas));
        
        window.addEventListener("resize",this.handleResize.bind(this));
      }
      handleResize(){
        const canvas=this.canvas.getDomNode();
        canvas.width=window.innerWidth;
        canvas.height=window.innerHeight;
        this.canvas.handleResize(window.innerWidth,window.innerHeight);
      }
    }
    return{Application};
  })(daedalus,engine,scenes);