
let @ = macro {
	case {_
		$lib {function($typeParams ...) {$returnType}}
		function $name ($params ...) { $body ...}
	} => { 
		return #{
			funType($name,$types...);
			var $name =
				function $name ($params ...) { $body ...};
		}
	}
	
	case{_
		$lib $types
		var $name
	} => {
		return #{
			type($name,$types)
			var $name
		}
	}	
	
	
}

macro type{
	case{_($name,$type)}
	=> {
		u = require('util');
		function getType(syntax){
			var token = syntax.token;

			if(token.value==='{}'){
				var converted = token.inner.map(getType);
				return '{type:obj,'+converted.join('')+'}';
			}else if(token.value==='()'){
				var converted = token.inner.map(getType);
				converted = converted.map(function(target,index,array){
					if(target===',')return ',';
					if(index==array.length-1){
						return 'returnType:'+target;
					}else{
						//add the param to the typing info
						console.log()
						return 'param'+index/2+':'+target;
					}
				});
				return '{type:fun,'+converted.join('')+'}';

			}else return token.value;
		}
		function addType(name,type){
			var types = ['number','string','obj','fun','top','bottom','boolean','star'];
			types = types.map(function(type){
				return 'var '+type+' = \''+type+'\';';
			})
			var typeString = types.join('')
			process.types[name] = eval(typeString+'var ret = '+typeInfo+'; ret');
		}
		var lineNum = (#{$name}[0].token.sm_lineNumber);

		var type = #{$type}[0];
		var typeInfo=getType(type);
		addType(unwrapSyntax(#{$name}),typeInfo);


		return #{};
	}
}

