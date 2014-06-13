
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
	
	case{
		_ $lib ($types ...)
		var $name = function($params ...){$inner ...}
	} => {
		var params = #{this, $params...};
		var types = #{$types...};
		var toReturn = #{};
		var typeID = #{type};

		for(var i=0;i<params.length;i+=2){
			var name = [params[i]]; 
			var comma = #{,};
			var second = [types[i]];
			var inner = name.concat(comma).concat(second);	
			var paren = makeDelim('()',inner,params[i]);
			var full = typeID.concat(paren);
			toReturn = toReturn.concat(full);
		}

		var funBody = makeDelim('{}',toReturn.concat(#{$inner...}),params[0]);

		return #{type($name,($types...)); var $name = function($params ...)}.concat(funBody);
	}
	case{_
		$lib $types
		var $name
	} => {
		return #{
			type($name,$types);
			var $name
		}
	}	
	
	
}

