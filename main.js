fs = require('fs');
esprima = require('esprima');
sweet = require('sweet.js');
var types = {};
var tempTypes = {};
var sideEffects = {};
var thisBinding = null;
process.types = {};
var functionDepth = 0;
var ifDepth = 0;

console.log(process.argv);

//var types = [];
var code = fs.readFileSync(process.argv[2],'utf8');
var macros = fs.readFileSync('./macros.js','utf8');
var macros2 = fs.readFileSync('./macros2.js','utf8');


//sweet.loadMacro('./macros.js');
code = sweet.compile(macros2+code, {readableNames:false}).code;
//console.log(code);
code = sweet.compile(macros+code,{readableNames:true}).code;

var tree = esprima.parse(code);
walkTree(tree);

function walkTree(tree){
	if(!tree)return;


	if(tree.type === 'FunctionExpression')functionDepth++;
	if(tree.type === 'IfStatement'){
		var original = copyTemp();
		walkTree(tree.consequent);
		var conCopy = copyTemp();	
		tempTypes = original;
		walkTree(tree.alternate);
		var altCopy = copyTemp();
		tempTypes = mergeTemps(conCopy,altCopy);
		return;
	}
	
	if(tree.type === 'FunctionExpression'){
//		var thisType = getType(thisBinding);
		var expectedType = getType(tree)['param0'];// tree.callee.typeInfo['param0'];
		process.types['this'] = expectedType;//thisType;
	}	

	for(key in tree){
		if(typeof tree[key] === 'object')walkTree(tree[key]);
	}	

	typeNode(tree,getType(tree));
	if(functionDepth === 0 && tree.type !='ExpressionStatement') runEffect(tree);
	if(tree.type === 'FunctionExpression')functionDepth--;


	/* these are doing the side effects
	//must be after because it overwrites it's childrens
	//mistakes with unions of them
	if(tree.type === 'IfStatement' && functionDepth==0){
		var effect = typeIf(tree);
		console.log("in main if loop");
		console.log(effect);
		activateIf(effect);
	}
	*/
}


function mergeTemps(con,alt){
	for(prop in con){
		if(!alt[prop]){
			alt[prop]=con[prop];
		}else{//} if(!isEqual(con[prop],alt[prop])){
			alt[prop]={orType:true, con:con[prop], alt:alt[prop]}; 
		}
	}
	return alt;
}
function typeIf(ifStatement){
	consequence = getSideEffects(ifStatement.consequent);
	alternate = getSideEffects(ifStatement.alternate);
	return {ifExpression:true, con: consequence, alt: alternate};	
}

function unifyFunctionEffects(functions){
	var effects = {};
	for(var i = 0;i<functions.length;i++){
		effects = unifyEffects(effects,sideEffects[functions[i]]);
	}
	return effects;
}

//two overwrites one
function unifyEffects(one,two){
	for(prop in two){
		one[prop] = two[prop];
	}
	return one;
}


function checkMatch(id, value){
	if(id === 'star' || value === 'star')return true;
	if(id==='top')return true;
	else if(id===undefined)return true;
	else if(value==='bottom')return true;
	else if(value===undefined)return false;

	if(typeof(value)==='object' && value.orType){
		return checkMatch(id,value.con) && checkMatch(id,value.alt);
	}

	if(typeof(id)==='string'){
		if(typeof(value)!=='string')return false;
		else return id == value;
	}
	if(id.type==='obj'){
		for(prop in id){
			if(value[prop]===undefined)return false;
			if(!checkMatch(id[prop],value[prop]))return false;
		}
		return true;
	}else if(id.type === 'fun'){
		for(prop in id){
			if(value[prop]===undefined)return false;
			if(prop === 'returnType'){
				if(!checkMatch(id[prop],value[prop]))return false;
			}
			else if(!checkMatch(value[prop],id[prop]))return false;
		}
		return true;
	}
}

function runEffect(tree){
	//console.log("running an effect");
	//console.log(tree);
	if(tree.type === 'Literal') return getType(tree);
	else if(tree.type === 'Identifier') return getType(tree);
	else if(tree.type === 'ObjectExpression') return tree;
	else if(tree.type === 'FunctionExpression'){
		return tree.body;	
	}
	else if(tree.type === 'BinaryExpression');//not in yet return tree.left.typeInfo;
	else if(tree.type === 'MemberExpression') return getType(tree);
	else if(tree.type==='AssignmentExpression') return runAssign(tree.left, tree.right);
	else if(tree.type === 'VariableDeclarator') return runAssign(tree.id, tree.init);
	else if(tree.type==='CallExpression') return runCall(tree);
	else if(tree.type === 'ExpressionStatement') runEffect(tree.expression);
	else return "error";
}

function getEffect(tree){
	if(tree.type === 'FunctionExpression'){
		return tree.body;
	}else if(tree.type==='Identifier'){
		return tree;
	}else{
		return {};
	}

}



function isEqual(obj1,obj2){
	if(typeof(obj1) !== typeof(obj2))return false;
	if(typeof(obj1)==='object'){
		for(prop in obj1){
			if(!isEqual(obj1[prop],obj2[prop]))return false;
		}
	}else if(obj1!==obj2)return false;
	return true;
}

function copyTemp(){
	return JSON.parse(JSON.stringify(tempTypes));
}
function runAssign(left, right){
	//var rightEffect = runEffect(right);
	if(!isTemp(left)){
		if(!checkMatch(getType(left),getType(right))){
			console.log("error assignment "+left.name+" to "+JSON.stringify(getType(right))+' when it is type '+JSON.stringify(getType(left)));
//			console.log(left);
//			console.log(getType(right));
//			console.log("do they match "+checkMatch(getType(left),getType(right)));
		}
	}else{
		//they don't need to match
		setTemp(left,getType(right));
	}
	//sets up any effects if needed
	setSideEffects(left,getEffect(right));
}

function runCall(tree){
	if(!getSideEffects(tree.callee)){
		console.log("error no effects");
		console.log(tree);
	}
	var body = getSideEffects(tree.callee).body;
	for(var i = 0;i<body.length;i++){
		runEffect(body[i]);
	}	
	return getReturnType(body);
}

function setSideEffects(left,right){
	//if it's not a function no side effects
//	if(right && !right.type=== 'BlockStatement')return;
	if(right.type === 'BlockStatement'){
		if(left.type === 'Identifier'){
			sideEffects[left.name]=right;
		}else if(left.type === 'MemberExpression'){
			getSideEffects(left.object)[left.property.name] = right;
		}
	}else if(right.type === 'ObjectExpression'){
		var toReturn = {};
		for(var i = 0;i<right.properties.length;i++){
			toReturn[right.properties[i].key.name] = right.properties[i].value;
		}
		if(left.type === 'Identifier'){
			sideEffects[left.name]=toReturn;
		}else if(left.type === 'MemberExpression'){
			getSideEffects(left.object)[left.property.name] = toReturn;
		}
	}
}

function getSideEffects(left){
	if(left.type === 'Identifier') return sideEffects[left.name];
	else if(left.type === 'MemberExpression'){
		var effects = getSideEffects(left.object)[left.property.name];
		if(effects.type === 'Identifier')return getSideEffects(effects);
		else return getSideEffects(left.object)[left.property.name];
	}
}

function setTemp(left,right){
	if(left.type === 'Identifier'){
		tempTypes[left.name]=right;
	}else if(left.type === 'MemberExpression'){
		getTemp(left.object)[left.property.name] = right;
	}
}

function getTemp(left){
	if(left.type === 'Identifier') return tempTypes[left.name];
	else if(left.type === 'MemberExpression'){
		return getTemp(left.object)[left.property.name];
	}
}

/*
function getEffect(tree){
	if(tree.type === 'Literal') return tree;//{literal:true, type:getType(tree)};
	else if(tree.type === 'Identifier') return tree;//{name:true, lookup:tree.name}; //probably should look up side effects
	else if(tree.type === 'ObjectExpression') return effectObject(tree.properties);//maybe should have an effect?
	else if(tree.type === 'FunctionExpression') return effectFunction(tree.body);//probably should add an effect
	else if(tree.type === 'Property') return {property:true,lookup:tree.key.name, type:getEffect(tree.value) }
//	else if(tree.type === 'BinaryExpression') return {};//only if they can change types
	else if(tree.type === 'MemberExpression') return {};//might return the effect of the object expression
	else if(tree.type === 'AssignmentExpression') return {assign:true, left:getEffect(tree.left), right: getEffect(tree.right)}; 
	else if(tree.type === 'VariableDeclarator') return {assign:true, left:getEffect(tree.id), right: getEffect(tree.init)}; 
	else if(tree.type === 'CallExpression') return {call:true, name:getEffect(tree.callee)};
	else return "error in effects";
}

function effectFunction(body){
	var effects = [];
	for(var i = 0;i<body.length;i++){
		effects.push(body.effect);
	}	
	return effects;
}

function effectObject(properties){
	var effects = {};
	for(var i =0;i<properties.length;i++){
		var effect = properties[i].effect;
		effects[effect.lookup] = effect.type;
	}
	return effects;
}

*/


function getType(tree){
	if(!tree)return null;
	if(tree.type === 'Literal') return typeof(tree.value);
	else if(tree.type === 'Identifier') return lookup(tree);
	else if(tree.type === 'ObjectExpression') return typeObj(tree);
	else if(tree.type === 'FunctionExpression') return typeFun(tree);
	else if(tree.type === 'BinaryExpression') return tree.left.typeInfo;
	else if(tree.type === 'MemberExpression') return typeMember(tree);
	else if(tree.type==='AssignmentExpression') return typeAssign(tree.left, tree.right);
	else if(tree.type === 'VariableDeclarator') return typeAssign(tree.id, tree.init);
	else if(tree.type==='CallExpression') return typeCall(tree);
	else if(tree.type === '')return 'error';
	else return "error";
}

function typeCall(tree){
	if(tree.callee.typeInfo===undefined)return;
	if(tree.callee.typeInfo.type!='fun')console.log("error "+tree.callee+"is not a function");
	//check it's arguments
	console.log(tree.arguments);
	var thisType = getType(thisBinding);
	var expectedType = tree.callee.typeInfo['param0'];
	if(!checkMatch(thisType,expectedType)){
		console.log("this has type "+thisType+' but expected '+expectedType);
	}
	process.types['this']=thisType;

	for(var i=1;i<tree.arguments.length;i++){
		var argType = getType(tree.arguments[i]);
		var expectedType = tree.callee.typeInfo['param'+i];
		console.log("checking "+argType);
		if(!checkMatch(expectedType,argType)){
			console.log("argument has type "+argType+' but expected '+expectedType);
		}
	}
	return tree.callee.typeInfo.returnType;
}


function typeAssign(left,right){
	return {};
}

function typeMember(tree){
	//warn if the property isn't in the type for that object
	if(tree.object.typeInfo && tree.object.typeInfo[tree.property.name]===undefined){
		console.log('warning property '+tree.property.name+' is not in type');
		console.log(tree.object.typeInfo);
	}
	thisBinding = tree.object;
	return lookup(tree);
}

function getReturnType(body){
	var returns = [];
	for(key in body){
		if(typeof body[key] === 'object'){
			var ret = getReturnType(body[key]);
			if(ret)returns.push(ret);
		}
	}	
	if(body.type==='ReturnStatement'){
		return getType(body.argument);
	}
	var returnType = 'bottom';
	for(var i =0;i<returns.length;i++){
		if(checkMatch(returns[i],returnType)){
			returnType = returns[i];
		}else{
			returnType = 'top';
		}
	}
	return returnType;
}

function typeFun(tree){
	var toReturn = {type:'fun', returnType:'bottom'};
	var retType = getReturnType(tree.body);
	toReturn.returnType = retType;
	toReturn['param0']='star';
	for(var i = 1;i<tree.params.length+1;i++){
		toReturn['param'+i] = 'top';
	}	
	return toReturn;
}

function typeObj(tree){
	var toReturn = {type:'obj'};
	for(var i =0;i<tree.properties.length;i++){
		var curProp = tree.properties[i];
		toReturn[curProp.key.name] = getType(curProp.value);
	}
	return toReturn;
}

function lookup(node){
	if(node.type === 'Identifier'){
		type = process.types[node.name];
		if(!type){
			return tempTypes[node.name];
		}
		return type;
	}
	else if(node.type === 'MemberExpression'){
		return lookup(node.object)[node.property.name];
	}

}

function isTemp(node){
	if(node.type === 'Identifier'){
		if(process.types[node.name])return false;
		else return true;
	}else if(node.type === 'MemberExpression'){
		return isTemp(node.object);
	}
}


function typeNode(tree,type){
	tree.typeInfo = type;
}


